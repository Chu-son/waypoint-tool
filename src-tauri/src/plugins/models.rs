use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PluginInputType {
    Point,
    Points,
    PointList,
    Rectangle,
    Waypoint,
    Annotation,
    CustomLayer,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct CellValueConstants {
    pub free: i8,
    pub obstacle: i8,
    pub unknown: i8,
}

impl Default for CellValueConstants {
    fn default() -> Self {
        Self {
            free: 0,
            obstacle: 100,
            unknown: -1,
        }
    }
}

fn default_encoding() -> String {
    "int8_zlib_base64".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OccupancyGridData {
    pub width: u32,
    pub height: u32,
    pub resolution: f64,
    pub origin: [f64; 3],  // [x, y, yaw]
    pub data: String,      // zlib + base64 encoded string
    #[serde(default = "default_encoding")]
    pub encoding: String,
    #[serde(default)]
    pub cell_values: CellValueConstants,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginMapLayer {
    pub image_base64: String,
    pub info: Option<serde_json::Value>,
    pub visible: bool,
    #[serde(default)]
    pub blend_mode: String,
    #[serde(default)]
    pub z_index: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginInputDef {
    pub id: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(rename = "type")]
    pub input_type: PluginInputType,
    #[serde(default)]
    pub min_points: Option<usize>,
    #[serde(default)]
    pub max_points: Option<usize>,
    #[serde(default)]
    pub allow_yaw: Option<bool>,
    #[serde(default)]
    pub object_type: Option<String>,
    #[serde(default)]
    pub multiple: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PluginDependencyDef {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub version: String,
}

fn normalize_version_for_semver(v: &str) -> String {
    let clean = v.trim().trim_start_matches('v').trim_start_matches('V');
    let parts: Vec<&str> = clean.split('.').collect();
    match parts.len() {
        1 if !parts[0].is_empty() => format!("{}.0.0", parts[0]),
        2 => format!("{}.{}.0", parts[0], parts[1]),
        _ => clean.to_string(),
    }
}

impl PluginDependencyDef {
    /// Check if candidate_version satisfies this semver requirement (or wildcard/exact match)
    pub fn matches_version(&self, candidate_version: &str) -> bool {
        let req_str = self.version.trim();
        if req_str == "*" || req_str.is_empty() {
            return true;
        }

        let cand_norm = normalize_version_for_semver(candidate_version);

        if let Ok(req) = semver::VersionReq::parse(req_str) {
            if let Ok(ver) = semver::Version::parse(&cand_norm) {
                return req.matches(&ver);
            }
        }

        self.version == candidate_version || self.version == cand_norm
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PythonDependencyDef {
    pub name: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub optional: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct PipelineStepExportsDef {
    #[serde(default)]
    pub custom_layers: Option<bool>,
    #[serde(default)]
    pub waypoints: Option<bool>,
    #[serde(default)]
    pub annotations: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PipelineStepDef {
    pub step_id: String,
    pub plugin_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub bindings: HashMap<String, String>,
    #[serde(default)]
    pub property_overrides: Option<serde_json::Value>,
    #[serde(default)]
    pub exports: Option<PipelineStepExportsDef>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PipelineRecipeDef {
    #[serde(default)]
    pub steps: Vec<PipelineStepDef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginManifest {
    pub name: String,
    pub version: Option<String>,
    #[serde(default)]
    pub category: Option<String>, // "waypoint_generator" | "map_layer_generator" | "path_calculator"
    #[serde(default)]
    pub primary_output: Option<String>, // "waypoints" | "custom_layer" | "annotations" | "path_calculator"
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub plugin_type: String, // "python", "wasm", "python_library", or "pipeline"
    #[serde(default)]
    pub executable: String,
    #[serde(default)]
    pub module_name: Option<String>,
    #[serde(default)]
    pub inputs: Vec<PluginInputDef>,
    #[serde(default)]
    pub needs: Vec<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub properties: Vec<serde_json::Value>,
    #[serde(default)]
    pub legacy_ids: Vec<String>,
    #[serde(default)]
    pub plugin_dependencies: Vec<PluginDependencyDef>,
    #[serde(default)]
    pub python_dependencies: Vec<PythonDependencyDef>,
    #[serde(default)]
    pub pipeline: Option<PipelineRecipeDef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginInstance {
    pub id: String,
    pub manifest: PluginManifest,
    pub folder_path: String,
    pub is_builtin: bool,
    /// SDK version detected from wpt_plugin.py in the plugin directory (None if not found)
    #[serde(default)]
    pub sdk_version: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_python_manifest_deserialize() {
        let json = r#"{
            "name": "Sweep Generator",
            "description": "Generates a sweep path from a start point.",
            "type": "python",
            "executable": "main.py",
            "inputs": [{"id": "start_point", "type": "point", "label": "Start"}],
            "properties": [{"name": "pitch", "label": "Pitch", "type": "float", "default": 1.0}],
            "needs": ["transform"]
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Sweep Generator");
        assert_eq!(manifest.description.as_deref(), Some("Generates a sweep path from a start point."));
        assert_eq!(manifest.plugin_type, "python");
        assert_eq!(manifest.inputs.len(), 1);
        assert_eq!(manifest.properties.len(), 1);
        assert_eq!(manifest.needs.len(), 1);
    }

    #[test]
    fn test_wasm_manifest_deserialize() {
        let json = r#"{
            "name": "WASM Plugin",
            "type": "wasm",
            "executable": "plugin.wasm",
            "inputs": [],
            "properties": []
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.plugin_type, "wasm");
        assert_eq!(manifest.executable, "plugin.wasm");
    }

    #[test]
    fn test_manifest_defaults_empty_arrays() {
        let json = r#"{
            "name": "Minimal",
            "type": "python",
            "executable": "run.py"
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert!(manifest.description.is_none());
        assert!(manifest.inputs.is_empty());
        assert!(manifest.properties.is_empty());
        assert!(manifest.needs.is_empty());
    }

    #[test]
    fn test_points_input_manifest_deserialize() {
        let json = r#"{
            "name": "Drivable Area Layer Generator",
            "category": "map_layer_generator",
            "type": "python",
            "executable": "main.py",
            "inputs": [
                {
                    "id": "seed_points",
                    "label": "Seed Points",
                    "type": "points",
                    "min_points": 1,
                    "max_points": 50,
                    "allow_yaw": false
                }
            ],
            "properties": []
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Drivable Area Layer Generator");
        assert_eq!(manifest.inputs.len(), 1);
        assert_eq!(manifest.inputs[0].input_type, PluginInputType::Points);
        assert_eq!(manifest.inputs[0].min_points, Some(1));
        assert_eq!(manifest.inputs[0].max_points, Some(50));
        assert_eq!(manifest.inputs[0].allow_yaw, Some(false));
    }

    #[test]
    fn test_annotation_and_custom_layer_input_manifest_deserialize() {
        let json = r#"{
            "name": "Drivable Area (Annotation Seeds)",
            "category": "map_layer_generator",
            "type": "python",
            "executable": "main.py",
            "inputs": [
                {
                    "id": "seed_annotations",
                    "label": "Seed Point Annotations",
                    "type": "annotation",
                    "object_type": "point",
                    "multiple": true
                },
                {
                    "id": "obstacle_layer",
                    "label": "Obstacle Layer",
                    "type": "custom_layer",
                    "multiple": false
                }
            ],
            "properties": []
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Drivable Area (Annotation Seeds)");
        assert_eq!(manifest.inputs.len(), 2);
        assert_eq!(manifest.inputs[0].input_type, PluginInputType::Annotation);
        assert_eq!(manifest.inputs[0].object_type, Some("point".to_string()));
        assert_eq!(manifest.inputs[0].multiple, Some(true));
        assert_eq!(manifest.inputs[1].input_type, PluginInputType::CustomLayer);
        assert_eq!(manifest.inputs[1].multiple, Some(false));
    }

    #[test]
    fn test_legacy_ids_manifest_deserialize() {
        let json = r#"{
            "name": "Sweep Generator",
            "type": "python",
            "executable": "main.py",
            "inputs": [],
            "legacy_ids": ["SweepOffsetLinesGenerator", "SweepGeneratorRS"]
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.legacy_ids, vec!["SweepOffsetLinesGenerator", "SweepGeneratorRS"]);
    }

    #[test]
    fn test_executable_manifest_with_dependencies_deserialize() {
        let json = r#"{
            "name": "Advanced Generator",
            "version": "1.2.0",
            "type": "python",
            "executable": "main.py",
            "plugin_dependencies": [
                { "id": "geom_lib", "name": "Geometry Library", "version": ">=1.0.0" }
            ],
            "python_dependencies": [
                { "name": "numpy", "version": ">=1.20", "optional": false, "description": "For array operations" },
                { "name": "scipy", "optional": true }
            ]
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Advanced Generator");
        assert_eq!(manifest.plugin_type, "python");
        assert_eq!(manifest.executable, "main.py");
        assert_eq!(manifest.plugin_dependencies.len(), 1);
        assert_eq!(manifest.plugin_dependencies[0].id, "geom_lib");
        assert_eq!(manifest.plugin_dependencies[0].name, "Geometry Library");
        assert_eq!(manifest.plugin_dependencies[0].version, ">=1.0.0");
        assert!(manifest.plugin_dependencies[0].matches_version("1.2.3"));
        assert!(!manifest.plugin_dependencies[0].matches_version("0.9.0"));

        assert_eq!(manifest.python_dependencies.len(), 2);
        assert_eq!(manifest.python_dependencies[0].name, "numpy");
        assert_eq!(manifest.python_dependencies[0].version.as_deref(), Some(">=1.20"));
        assert_eq!(manifest.python_dependencies[0].optional, Some(false));
        assert_eq!(manifest.python_dependencies[0].description.as_deref(), Some("For array operations"));
        assert_eq!(manifest.python_dependencies[1].name, "scipy");
        assert_eq!(manifest.python_dependencies[1].version, None);
        assert_eq!(manifest.python_dependencies[1].optional, Some(true));
    }

    #[test]
    fn test_python_library_manifest_deserialize() {
        let json = r#"{
            "name": "Shared Geometry Lib",
            "version": "1.0.0",
            "type": "python_library",
            "module_name": "wpt_geom",
            "description": "Shared geometry routines",
            "python_dependencies": [
                { "name": "shapely", "version": ">=2.0.0" }
            ]
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Shared Geometry Lib");
        assert_eq!(manifest.plugin_type, "python_library");
        assert_eq!(manifest.module_name.as_deref(), Some("wpt_geom"));
        assert!(manifest.executable.is_empty());
        assert_eq!(manifest.python_dependencies.len(), 1);
        assert_eq!(manifest.python_dependencies[0].name, "shapely");
        assert_eq!(manifest.python_dependencies[0].version.as_deref(), Some(">=2.0.0"));
    }

    #[test]
    fn test_pipeline_manifest_deserialize() {
        let json = r#"{
            "name": "Coverage and Path Pipeline",
            "version": "0.1.0",
            "type": "pipeline",
            "pipeline": {
                "steps": [
                    {
                        "step_id": "step1",
                        "plugin_id": "drivable_area_layer_generator",
                        "name": "Generate Drivable Area",
                        "bindings": {
                            "seed_points": "start_point"
                        },
                        "property_overrides": {
                            "expansion": 2.5
                        },
                        "exports": {
                            "custom_layers": true,
                            "waypoints": false,
                            "annotations": false
                        }
                    },
                    {
                        "step_id": "step2",
                        "plugin_id": "dijkstra_path_calculator",
                        "bindings": {
                            "start_point": "start_point",
                            "goal_point": "goal_point"
                        }
                    }
                ]
            }
        }"#;
        let manifest: PluginManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.name, "Coverage and Path Pipeline");
        assert_eq!(manifest.plugin_type, "pipeline");
        assert!(manifest.executable.is_empty());
        assert!(manifest.pipeline.is_some());
        let pipeline = manifest.pipeline.unwrap();
        assert_eq!(pipeline.steps.len(), 2);
        assert_eq!(pipeline.steps[0].step_id, "step1");
        assert_eq!(pipeline.steps[0].plugin_id, "drivable_area_layer_generator");
        assert_eq!(pipeline.steps[0].name.as_deref(), Some("Generate Drivable Area"));
        assert_eq!(pipeline.steps[0].bindings.get("seed_points").unwrap(), "start_point");
        assert_eq!(
            pipeline.steps[0].property_overrides.as_ref().unwrap().get("expansion").unwrap(),
            2.5
        );
        let exports = pipeline.steps[0].exports.as_ref().unwrap();
        assert_eq!(exports.custom_layers, Some(true));
        assert_eq!(exports.waypoints, Some(false));
        assert_eq!(exports.annotations, Some(false));

        assert_eq!(pipeline.steps[1].step_id, "step2");
        assert_eq!(pipeline.steps[1].plugin_id, "dijkstra_path_calculator");
        assert_eq!(pipeline.steps[1].bindings.get("goal_point").unwrap(), "goal_point");
        assert!(pipeline.steps[1].exports.is_none());
    }

    #[test]
    fn test_plugin_dependency_matches_version() {
        let dep_range = PluginDependencyDef {
            id: "my_dep".to_string(),
            name: "My Dep".to_string(),
            version: ">=1.0.0, <2.0.0".to_string(),
        };
        assert!(dep_range.matches_version("1.0.0"));
        assert!(dep_range.matches_version("1.5.2"));
        assert!(dep_range.matches_version("1.0")); // partial version normalization
        assert!(dep_range.matches_version("v1.2.3")); // v-prefix stripping
        assert!(!dep_range.matches_version("0.9.0"));
        assert!(!dep_range.matches_version("2.0.0"));

        let dep_wildcard = PluginDependencyDef {
            id: "any_dep".to_string(),
            name: "Any".to_string(),
            version: "*".to_string(),
        };
        assert!(dep_wildcard.matches_version("0.0.1"));
        assert!(dep_wildcard.matches_version("99.9.9"));

        let dep_caret = PluginDependencyDef {
            id: "caret_dep".to_string(),
            name: "Caret".to_string(),
            version: "^1.2.0".to_string(),
        };
        assert!(dep_caret.matches_version("1.2.3"));
        assert!(dep_caret.matches_version("1.9.0"));
        assert!(!dep_caret.matches_version("2.0.0"));
    }
}

