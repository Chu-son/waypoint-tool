use serde_json::Value as JsonValue;
use std::fs;
use std::path::Path;

/// Option Schema のフィールド定義（`FieldDef`）が満たすべき最低限の構造を検証する。
///
/// フィールドの型は再帰的（`list` の要素、`object` のフィールド、`map` の値、
/// `union` のバリアント）だが、その正規化・完全な検証はフロントエンド
/// (`src/utils/optionSchema.ts` の `normalizeOptionsSchema` / `validateSchema`)
/// が Single Source of Truth として担う。ここでは「壊れた YAML を早期に弾く」
/// ための構造チェックのみを行い、パース結果はそのまま JSON としてフロントへ返す。
fn validate_field_like(value: &JsonValue, path: &str) -> Result<(), String> {
    let obj = value
        .as_object()
        .ok_or_else(|| format!("{}: expected an object", path))?;

    for key in ["name", "label", "type"] {
        match obj.get(key) {
            Some(JsonValue::String(_)) => {}
            _ => return Err(format!("{}: missing required string field `{}`", path, key)),
        }
    }

    // `default_global`（既定値を連動させるグローバル変数名）は任意だが、あれば文字列であること。
    if let Some(v) = obj.get("default_global") {
        if !v.is_string() {
            return Err(format!("{}.default_global: expected a string", path));
        }
    }

    validate_recursive_shape(obj, path)
}

/// `definitions` の1件。`name`/`type` は必須だが、`label` は省略可能（`FieldDef` と異なる）。
fn validate_definition_like(value: &JsonValue, path: &str) -> Result<(), String> {
    let obj = value
        .as_object()
        .ok_or_else(|| format!("{}: expected an object", path))?;

    for key in ["name", "type"] {
        match obj.get(key) {
            Some(JsonValue::String(_)) => {}
            _ => return Err(format!("{}: missing required string field `{}`", path, key)),
        }
    }

    validate_recursive_shape(obj, path)
}

/// `name`/`label` を持たない型仕様ノード（list の item, map の value）の構造チェック。
fn validate_type_spec(value: &JsonValue, path: &str) -> Result<(), String> {
    let obj = value
        .as_object()
        .ok_or_else(|| format!("{}: expected an object", path))?;

    match obj.get("type") {
        Some(JsonValue::String(_)) => {}
        _ => return Err(format!("{}: missing required string field `type`", path)),
    }

    validate_recursive_shape(obj, path)
}

/// `presets`（プリセット。名前付きの値の候補）の構造を検証する。値の型自体はフロントエンドの
/// `validateSchema` が担うため、ここでは「配列であること」「各要素が `name` を持つこと」だけを見る。
fn validate_presets(obj: &serde_json::Map<String, JsonValue>, path: &str) -> Result<(), String> {
    if let Some(presets) = obj.get("presets") {
        let list = presets
            .as_array()
            .ok_or_else(|| format!("{}.presets: expected an array", path))?;
        for (i, p) in list.iter().enumerate() {
            let preset_obj = p
                .as_object()
                .ok_or_else(|| format!("{}.presets[{}]: expected an object", path, i))?;
            match preset_obj.get("name") {
                Some(JsonValue::String(s)) if !s.is_empty() => {}
                _ => {
                    return Err(format!(
                        "{}.presets[{}]: missing required non-empty string field `name`",
                        path, i
                    ))
                }
            }
        }
    }
    Ok(())
}

/// `type` の値に応じて、入れ子になった型仕様（item/fields/value/variants）を再帰的に検証する。
fn validate_recursive_shape(obj: &serde_json::Map<String, JsonValue>, path: &str) -> Result<(), String> {
    validate_presets(obj, path)?;
    match obj.get("type").and_then(|v| v.as_str()).unwrap_or("") {
        "list" => {
            if let Some(item) = obj.get("item") {
                validate_type_spec(item, &format!("{}.item", path))?;
            }
        }
        "object" => {
            if let Some(JsonValue::Array(fields)) = obj.get("fields") {
                for (i, f) in fields.iter().enumerate() {
                    validate_field_like(f, &format!("{}.fields[{}]", path, i))?;
                }
            }
        }
        "map" => {
            if let Some(v) = obj.get("value_type") {
                validate_type_spec(v, &format!("{}.value_type", path))?;
            }
        }
        "ref" => match obj.get("ref") {
            Some(JsonValue::String(s)) if !s.is_empty() => {}
            _ => return Err(format!("{}: missing required non-empty string field `ref`", path)),
        },
        "union" => {
            if let Some(JsonValue::Array(variants)) = obj.get("variants") {
                for (i, variant) in variants.iter().enumerate() {
                    let variant_path = format!("{}.variants[{}]", path, i);
                    match variant.get("value") {
                        Some(JsonValue::String(_)) => {}
                        _ => return Err(format!("{}: missing required string field `value`", variant_path)),
                    }
                    if let Some(JsonValue::Array(fields)) = variant.get("fields") {
                        for (j, f) in fields.iter().enumerate() {
                            validate_field_like(f, &format!("{}.fields[{}]", variant_path, j))?;
                        }
                    }
                }
            }
        }
        _ => {}
    }
    Ok(())
}

/// YAML ファイルから Option Schema を読み込み、構造検証済みの JSON として返す。
/// スキーマの正規化（旧形式からの変換、既定値の補完等）はフロントエンド側の責務。
pub fn load_options_schema(yaml_path: &str) -> Result<JsonValue, String> {
    let path = Path::new(yaml_path);
    let yaml_content = fs::read_to_string(path).map_err(|e| format!("Failed to read schema YAML: {}", e))?;

    let yaml_value: serde_yaml::Value =
        serde_yaml::from_str(&yaml_content).map_err(|e| format!("Failed to parse schema YAML: {}", e))?;
    let json_value: JsonValue =
        serde_json::to_value(yaml_value).map_err(|e| format!("Failed to convert schema YAML: {}", e))?;

    let obj = json_value
        .as_object()
        .ok_or_else(|| "Options schema must be a YAML mapping".to_string())?;

    let options = obj.get("options").and_then(|v| v.as_array());
    match options {
        Some(list) => {
            for (i, opt) in list.iter().enumerate() {
                validate_field_like(opt, &format!("options[{}]", i))?;
            }
        }
        None => return Err("Options schema must have an `options` array".to_string()),
    }

    if let Some(JsonValue::Array(globals)) = obj.get("globals") {
        for (i, g) in globals.iter().enumerate() {
            validate_field_like(g, &format!("globals[{}]", i))?;
        }
    }

    if let Some(JsonValue::Array(definitions)) = obj.get("definitions") {
        for (i, d) in definitions.iter().enumerate() {
            validate_definition_like(d, &format!("definitions[{}]", i))?;
        }
    }

    Ok(json_value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp_yaml(content: &str) -> tempfile::NamedTempFile {
        let mut file = tempfile::NamedTempFile::new().unwrap();
        file.write_all(content.as_bytes()).unwrap();
        file
    }

    #[test]
    fn test_load_valid_options_schema() {
        let file = write_temp_yaml(
            r#"
options:
  - name: velocity
    label: "Target Speed"
    type: float
    default: 1.0
  - name: actions
    label: "Actions List"
    type: list
    item:
      type: string
      enum_values: ["dock", "undock"]
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap()).expect("valid schema should parse");
        let options = result.get("options").unwrap().as_array().unwrap();
        assert_eq!(options.len(), 2);
        assert_eq!(options[0].get("name").unwrap().as_str(), Some("velocity"));
        assert_eq!(
            options[1].get("item").unwrap().get("type").unwrap().as_str(),
            Some("string")
        );
    }

    #[test]
    fn test_load_schema_with_globals() {
        let file = write_temp_yaml(
            r#"
options: []
globals:
  - name: default_speed
    label: "Default Speed"
    type: float
    value: 0.5
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap()).expect("valid schema should parse");
        let globals = result.get("globals").unwrap().as_array().unwrap();
        assert_eq!(globals.len(), 1);
        assert_eq!(globals[0].get("name").unwrap().as_str(), Some("default_speed"));
    }

    #[test]
    fn test_load_schema_without_globals() {
        let file = write_temp_yaml("options: []");
        let result = load_options_schema(file.path().to_str().unwrap()).expect("valid schema should parse");
        assert!(result.get("globals").is_none());
    }

    #[test]
    fn test_load_schema_missing_required_field() {
        let file = write_temp_yaml(
            r#"
options:
  - missing_name_field: true
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap());
        assert!(result.is_err(), "Should error on missing required fields");
    }

    #[test]
    fn test_load_schema_recursive_union_shape() {
        // mg_robot の on_reached_actions のようなタグ付きユニオンを再帰検証できることを確認する。
        let file = write_temp_yaml(
            r#"
options:
  - name: on_reached_actions
    label: "Actions"
    type: list
    item:
      type: union
      discriminator: type
      variants:
        - value: service
          fields:
            - {name: service, label: Service, type: string}
            - {name: request, label: Request, type: map}
        - value: wait
          fields:
            - {name: countdown_ms, label: Countdown, type: integer, default: 3000}
        - value: amcl_reset
          fields: []
"#,
        );
        load_options_schema(file.path().to_str().unwrap()).expect("recursive union schema should parse");
    }

    #[test]
    fn test_load_schema_invalid_union_variant() {
        let file = write_temp_yaml(
            r#"
options:
  - name: actions
    label: "Actions"
    type: list
    item:
      type: union
      variants:
        - fields: []
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap());
        assert!(result.is_err(), "Should error when a variant is missing `value`");
    }

    #[test]
    fn test_load_schema_with_definitions_and_ref() {
        let file = write_temp_yaml(
            r#"
options:
  - name: on_reached_actions
    label: "Actions"
    type: list
    item:
      type: ref
      ref: action
definitions:
  - name: action
    type: union
    discriminator: type
    variants:
      - value: wait
        fields:
          - {name: countdown_ms, label: Countdown, type: integer, default: 3000}
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap()).expect("schema with ref should parse");
        let definitions = result.get("definitions").unwrap().as_array().unwrap();
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].get("name").unwrap().as_str(), Some("action"));
    }

    #[test]
    fn test_load_schema_definition_without_label_is_valid() {
        // definitions は label が無くても構造上は有効（FieldDef と違い label は必須ではない）。
        let file = write_temp_yaml(
            r#"
options: []
definitions:
  - name: action
    type: string
"#,
        );
        load_options_schema(file.path().to_str().unwrap()).expect("definition without label should parse");
    }

    #[test]
    fn test_load_schema_ref_missing_ref_field_is_invalid() {
        let file = write_temp_yaml(
            r#"
options:
  - name: a
    label: A
    type: ref
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap());
        assert!(result.is_err(), "Should error when a ref field has no `ref`");
    }

    #[test]
    fn test_load_schema_definition_missing_name_is_invalid() {
        let file = write_temp_yaml(
            r#"
options: []
definitions:
  - type: string
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap());
        assert!(result.is_err(), "Should error when a definition has no `name`");
    }

    #[test]
    fn test_load_schema_with_presets() {
        let file = write_temp_yaml(
            r#"
options:
  - name: tolerance
    label: "Tolerance"
    type: float
    presets:
      - {name: small, label: "Small", value: 0.1}
      - {name: large, label: "Large", value: 0.5}
    preset_only: true
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap()).expect("schema with presets should parse");
        let presets = result.get("options").unwrap()[0]
            .get("presets")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(presets.len(), 2);
    }

    #[test]
    fn test_load_schema_default_global_must_be_a_string() {
        let ok = write_temp_yaml(
            r#"
options:
  - name: through
    label: Through
    type: boolean
    default_global: g_through
globals:
  - name: g_through
    label: G
    type: boolean
    value: true
"#,
        );
        assert!(load_options_schema(ok.path().to_str().unwrap()).is_ok());

        let bad = write_temp_yaml(
            r#"
options:
  - name: through
    label: Through
    type: boolean
    default_global: 1
globals: []
"#,
        );
        assert!(load_options_schema(bad.path().to_str().unwrap()).is_err());
    }

    #[test]
    fn test_load_schema_preset_missing_name_is_invalid() {
        let file = write_temp_yaml(
            r#"
options:
  - name: tolerance
    label: "Tolerance"
    type: float
    presets:
      - {value: 0.1}
"#,
        );
        let result = load_options_schema(file.path().to_str().unwrap());
        assert!(result.is_err(), "Should error when a preset has no `name`");
    }

    #[test]
    fn test_load_schema_invalid_yaml_syntax() {
        let file = write_temp_yaml("options: [this is not valid: yaml: at all");
        let result = load_options_schema(file.path().to_str().unwrap());
        assert!(result.is_err());
    }
}
