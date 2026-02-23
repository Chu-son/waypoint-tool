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

#[derive(Debug, Serialize, Deserialize)]
pub struct OptionsSchema {
    pub options: Vec<OptionDef>,
}

pub fn load_options_schema(yaml_path: &str) -> Result<OptionsSchema, String> {
    let path = Path::new(yaml_path);
    let yaml_content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read schema YAML: {}", e))?;
    
    let schema: OptionsSchema = serde_yaml::from_str(&yaml_content)
        .map_err(|e| format!("Failed to parse schema YAML: {}", e))?;

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
    fn test_parse_invalid_schema() {
        let yaml_str = r#"
options:
  - missing_name_field: true
"#;
        let result: Result<OptionsSchema, _> = serde_yaml::from_str(yaml_str);
        assert!(result.is_err(), "Should error on missing required fields");
    }
}
