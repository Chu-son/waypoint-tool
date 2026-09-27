use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct OptionDef {
    pub name: String,
    pub label: String,
    #[serde(rename = "type")]
    pub option_type: String, // "float", "integer", "string", "boolean", "list"
    pub item_type: Option<String>,
    pub default: Option<serde_yaml::Value>,
    pub enum_values: Option<Vec<String>>,
}

/// プロジェクト全体で1つの値を持つ変数（ウェイポイントには付随しない）。
#[derive(Debug, Serialize, Deserialize)]
pub struct GlobalFieldDef {
    pub name: String,
    pub label: String,
    #[serde(rename = "type")]
    pub option_type: String,
    pub item_type: Option<String>,
    pub enum_values: Option<Vec<String>>,
    pub value: Option<serde_yaml::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OptionsSchema {
    pub options: Vec<OptionDef>,
    #[serde(default)]
    pub globals: Vec<GlobalFieldDef>,
}

pub fn load_options_schema(yaml_path: &str) -> Result<OptionsSchema, String> {
    let path = Path::new(yaml_path);
    let yaml_content = fs::read_to_string(path).map_err(|e| format!("Failed to read schema YAML: {}", e))?;

    let schema: OptionsSchema =
        serde_yaml::from_str(&yaml_content).map_err(|e| format!("Failed to parse schema YAML: {}", e))?;

    Ok(schema)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_options_schema() {
        let yaml_str = r#"
options:
  - name: velocity
    label: "Target Speed"
    type: float
    default: 1.0
  - name: actions
    label: "Actions List"
    type: list
    item_type: string
    enum_values: ["dock", "undock"]
"#;
        let schema: OptionsSchema = serde_yaml::from_str(yaml_str).expect("Failed to parse valid schema");
        assert_eq!(schema.options.len(), 2);

        let opt1 = &schema.options[0];
        assert_eq!(opt1.name, "velocity");
        assert_eq!(opt1.option_type, "float");
        assert!(opt1.item_type.is_none());

        let opt2 = &schema.options[1];
        assert_eq!(opt2.name, "actions");
        assert_eq!(opt2.option_type, "list");
        assert_eq!(opt2.item_type.as_deref(), Some("string"));
        assert!(opt2.enum_values.is_some());
    }

    #[test]
    fn test_parse_schema_with_globals() {
        let yaml_str = r#"
options: []
globals:
  - name: default_speed
    label: "Default Speed"
    type: float
    value: 0.5
"#;
        let schema: OptionsSchema = serde_yaml::from_str(yaml_str).expect("Failed to parse schema with globals");
        assert_eq!(schema.globals.len(), 1);
        assert_eq!(schema.globals[0].name, "default_speed");
        assert_eq!(schema.globals[0].option_type, "float");
        assert!(schema.globals[0].value.is_some());
    }

    #[test]
    fn test_parse_schema_without_globals_defaults_to_empty() {
        let schema: OptionsSchema = serde_yaml::from_str("options: []").expect("Failed to parse schema");
        assert!(schema.globals.is_empty());
    }

    #[test]
    fn test_parse_invalid_schema() {
        let yaml_str = r#"
options:
  - missing_name_field: true
"#;
        let result: Result<OptionsSchema, _> = serde_yaml::from_str(yaml_str);
        assert!(result.is_err(), "Should error on missing required fields");
    }
}
