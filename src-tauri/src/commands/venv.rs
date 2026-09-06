use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;

/// Check whether specified Python packages/modules are importable in the given Python environment.
///
/// Returns a map of package name -> bool indicating whether each package is installed.
pub fn check_python_packages_sync(
    python_path: &str,
    packages: &[String],
) -> Result<HashMap<String, bool>, String> {
    let py = python_path.trim();
    if py.is_empty() {
        return Err("Python interpreter path must not be empty.".to_string());
    }

    if packages.is_empty() {
        return Ok(HashMap::new());
    }

    let script = r#"
import sys, json, importlib.util, re

ALIASES = {
    "opencv-python": ["cv2"],
    "opencv_python": ["cv2"],
    "pyyaml": ["yaml"],
    "scikit-learn": ["sklearn"],
    "scikit_learn": ["sklearn"],
    "pillow": ["PIL"],
}

meta = None
try:
    import importlib.metadata as meta
except Exception:
    try:
        import importlib_metadata as meta
    except Exception:
        pass

results = {}
for pkg in sys.argv[1:]:
    clean_pkg = re.split(r'[=><!~]', pkg)[0].strip()
    if not clean_pkg:
        results[pkg] = False
        continue

    is_installed = False

    # 1. Check installed distribution via importlib.metadata (handles pip package names with hyphens)
    if meta is not None:
        try:
            meta.distribution(clean_pkg)
            is_installed = True
        except Exception:
            pass

    # 2. Check importable module spec
    if not is_installed:
        candidates = []
        lower = clean_pkg.lower()
        if lower in ALIASES:
            candidates.extend(ALIASES[lower])
        candidates.append(clean_pkg)
        if '-' in clean_pkg:
            candidates.append(clean_pkg.replace('-', '_'))

        for mod in candidates:
            try:
                spec = importlib.util.find_spec(mod)
                if spec is not None:
                    is_installed = True
                    break
            except Exception:
                pass
            try:
                __import__(mod)
                is_installed = True
                break
            except Exception:
                pass

    results[pkg] = is_installed

print("__WPT_PKGS__:" + json.dumps(results))
"#;

    let output = Command::new(py)
        .arg("-c")
        .arg(script)
        .args(packages)
        .output()
        .map_err(|e| format!("Failed to execute python interpreter at '{}': {}", py, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Python package check failed with exit code {:?}:\n{}",
            output.status.code(),
            stderr.trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();

    // Look for deterministic marker line first
    if let Some(marker_line) = trimmed.lines().find(|line| line.starts_with("__WPT_PKGS__:")) {
        let json_part = &marker_line["__WPT_PKGS__:".len()..];
        return serde_json::from_str::<HashMap<String, bool>>(json_part.trim()).map_err(|e| {
            format!(
                "Failed to parse marked package check JSON from '{}': {}",
                json_part, e
            )
        });
    }

    // Direct JSON parsing fallback
    match serde_json::from_str::<HashMap<String, bool>>(trimmed) {
        Ok(map) => Ok(map),
        Err(_) => {
            // In case Python prints any warnings before or after JSON output
            let json_line = trimmed
                .lines()
                .rev()
                .find(|line| line.trim().starts_with('{') && line.trim().ends_with('}'))
                .ok_or_else(|| {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    format!(
                        "Failed to parse package check output as JSON.\nStdout: {}\nStderr: {}",
                        trimmed, stderr
                    )
                })?;
            serde_json::from_str::<HashMap<String, bool>>(json_line.trim()).map_err(|e| {
                format!(
                    "Failed to parse package check JSON from '{}': {}",
                    json_line, e
                )
            })
        }
    }
}

/// Create a new Python virtual environment at the target directory using `python -m venv`.
///
/// Returns the absolute path to the newly created python interpreter executable.
pub fn create_virtualenv_sync(
    target_dir: &str,
    base_python: Option<&str>,
) -> Result<String, String> {
    let trimmed_dir = target_dir.trim();
    if trimmed_dir.is_empty() {
        return Err("Target directory must not be empty.".to_string());
    }

    let default_python = if cfg!(windows) { "python" } else { "python3" };
    let py_bin = match base_python {
        Some(p) if !p.trim().is_empty() => p.trim(),
        _ => default_python,
    };

    let target_path = PathBuf::from(trimmed_dir);
    let abs_target_path = if target_path.is_absolute() {
        target_path
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(target_path)
    };

    // Ensure parent directory exists before creating virtualenv
    if let Some(parent) = abs_target_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let mut output = Command::new(py_bin)
        .arg("-m")
        .arg("venv")
        .arg(&abs_target_path)
        .output()
        .map_err(|e| format!("Failed to run '{} -m venv': {}", py_bin, e))?;

    if !output.status.success() {
        let combined_msg = format!(
            "{} {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        // On Debian/Ubuntu systems, standard python3 may lack ensurepip by default.
        // Fall back to --without-pip to allow creating the environment.
        if combined_msg.contains("ensurepip") || combined_msg.contains("python3-venv") {
            let _ = std::fs::remove_dir_all(&abs_target_path);
            if let Ok(fallback_out) = Command::new(py_bin)
                .arg("-m")
                .arg("venv")
                .arg("--without-pip")
                .arg(&abs_target_path)
                .output()
            {
                if fallback_out.status.success() {
                    output = fallback_out;
                }
            }
        }
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let err_msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        return Err(format!(
            "Failed to create virtualenv at '{}' using '{}' (exit code {:?}):\n{}",
            abs_target_path.display(),
            py_bin,
            output.status.code(),
            err_msg
        ));
    }

    // Determine the path to the created python interpreter
    let python_exec = if cfg!(windows) {
        let p = abs_target_path.join("Scripts").join("python.exe");
        if p.exists() {
            p
        } else {
            abs_target_path.join("Scripts").join("python3.exe")
        }
    } else {
        let p = abs_target_path.join("bin").join("python");
        if p.exists() {
            p
        } else {
            abs_target_path.join("bin").join("python3")
        }
    };

    if !python_exec.exists() {
        return Err(format!(
            "Virtualenv was created, but Python interpreter was not found at expected path: {}",
            python_exec.display()
        ));
    }

    Ok(python_exec.to_string_lossy().to_string())
}

/// Install specified packages into the Python environment using `pip install`.
///
/// Returns combined stdout and stderr output on success, or an error string on failure.
pub fn install_pip_packages_sync(
    python_path: &str,
    packages: &[String],
) -> Result<String, String> {
    let py = python_path.trim();
    if py.is_empty() {
        return Err("Python interpreter path must not be empty.".to_string());
    }

    let valid_packages: Vec<String> = packages
        .iter()
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect();

    if valid_packages.is_empty() {
        return Ok("No packages to install.".to_string());
    }

    let output = Command::new(py)
        .arg("-m")
        .arg("pip")
        .arg("install")
        .args(&valid_packages)
        .output()
        .map_err(|e| format!("Failed to execute '{} -m pip install': {}", py, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        let mut combined = stdout.trim().to_string();
        if !stderr.trim().is_empty() {
            if !combined.is_empty() {
                combined.push('\n');
            }
            combined.push_str(stderr.trim());
        }
        Ok(combined)
    } else {
        let err_msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            stdout.trim().to_string()
        };
        if err_msg.contains("No module named pip") {
            return Err(format!(
                "pip is not installed in the Python environment '{}'.\n\
                On Debian/Ubuntu, install the 'python3-venv' package ('sudo apt install python3-venv')\n\
                or install pip into the virtual environment.",
                py
            ));
        }
        Err(format!(
            "pip install failed (exit code {:?}):\n{}",
            output.status.code(),
            err_msg
        ))
    }
}

// Tauri commands

#[tauri::command]
pub async fn check_python_packages(
    python_path: String,
    packages: Vec<String>,
) -> Result<HashMap<String, bool>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        check_python_packages_sync(&python_path, &packages)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn create_virtualenv(
    target_dir: String,
    base_python: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        create_virtualenv_sync(&target_dir, base_python.as_deref())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn install_pip_packages(
    python_path: String,
    packages: Vec<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        install_pip_packages_sync(&python_path, &packages)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_check_python_packages_empty() {
        let res = check_python_packages_sync("python3", &[]);
        assert!(res.is_ok());
        assert!(res.unwrap().is_empty());
    }

    #[test]
    fn test_check_python_packages_invalid_python() {
        let res = check_python_packages_sync(
            "nonexistent_python_binary_xyz_123",
            &["numpy".to_string()],
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_install_pip_packages_empty() {
        let res = install_pip_packages_sync("python3", &[]);
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "No packages to install.");

        let res2 = install_pip_packages_sync("python3", &["  ".to_string()]);
        assert!(res2.is_ok());
        assert_eq!(res2.unwrap(), "No packages to install.");
    }

    #[test]
    fn test_install_pip_packages_invalid_python() {
        let res = install_pip_packages_sync(
            "nonexistent_python_binary_xyz_123",
            &["numpy".to_string()],
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_create_virtualenv_empty_target() {
        let res = create_virtualenv_sync("", None);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Target directory must not be empty"));
    }

    #[test]
    fn test_create_virtualenv_invalid_base_python() {
        let tmp = TempDir::new().unwrap();
        let target = tmp.path().join("venv");
        let res = create_virtualenv_sync(
            &target.to_string_lossy(),
            Some("nonexistent_base_python_xyz_123"),
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_check_python_packages_empty_python_path() {
        let res = check_python_packages_sync("   ", &["sys".to_string()]);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Python interpreter path must not be empty"));
    }

    #[test]
    fn test_install_pip_packages_empty_python_path() {
        let res = install_pip_packages_sync("   ", &["numpy".to_string()]);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Python interpreter path must not be empty"));
    }

    #[test]
    fn test_check_python_packages_with_system_python() {
        let py = if cfg!(windows) { "python" } else { "python3" };
        // Check if py exists on the test runner
        if Command::new(py).arg("--version").output().is_ok() {
            let packages = vec![
                "sys".to_string(),
                "json".to_string(),
                "sys>=1.0".to_string(),
                "nonexistent_pkg_definitely_not_installed_xyz_987".to_string(),
            ];
            let res = check_python_packages_sync(py, &packages);
            if let Ok(map) = res {
                assert_eq!(map.get("sys"), Some(&true));
                assert_eq!(map.get("json"), Some(&true));
                assert_eq!(map.get("sys>=1.0"), Some(&true));
                assert_eq!(
                    map.get("nonexistent_pkg_definitely_not_installed_xyz_987"),
                    Some(&false)
                );
            }
        }
    }

    #[test]
    fn test_create_virtualenv_and_check_packages() {
        let py = if cfg!(windows) { "python" } else { "python3" };
        // Only run if base python supports -m venv
        let venv_check = Command::new(py).arg("-m").arg("venv").arg("-h").output();
        if let Ok(out) = venv_check {
            if out.status.success() {
                let tmp = TempDir::new().unwrap();
                // Test nested directory creation as well
                let target = tmp.path().join("nested").join("sub").join("test_env");
                let target_str = target.to_string_lossy().to_string();

                let create_res = create_virtualenv_sync(&target_str, Some(py));
                assert!(create_res.is_ok(), "create_virtualenv failed: {:?}", create_res.err());

                let venv_py = create_res.unwrap();
                assert!(std::path::Path::new(&venv_py).exists());

                // Check standard package in the created virtual environment
                let check_res = check_python_packages_sync(&venv_py, &["sys".to_string()]);
                assert!(check_res.is_ok());
                assert_eq!(check_res.unwrap().get("sys"), Some(&true));
            }
        }
    }
}
