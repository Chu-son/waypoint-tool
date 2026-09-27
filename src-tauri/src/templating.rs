use handlebars::Handlebars;
use minijinja::value::Value as JinjaValue;
use minijinja::{Environment, UndefinedBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// エクスポートテンプレートのレンダリングエンジン。
/// `ExportTemplate.engine` が未指定（旧プロジェクトのテンプレート）の場合は、
/// 後方互換のため Handlebars として扱う。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TemplateEngine {
    #[default]
    Handlebars,
    Jinja,
}

/// テンプレート文字列をコンテキストでレンダリングする。
pub fn render(engine: TemplateEngine, template: &str, ctx: &JsonValue) -> Result<String, String> {
    match engine {
        TemplateEngine::Handlebars => {
            let reg = Handlebars::new();
            reg.render_template(template, ctx)
                .map_err(|e| format!("Handlebars render error: {}", e))
        }
        TemplateEngine::Jinja => render_jinja(template, ctx),
    }
}

fn deg_filter(v: f64) -> f64 {
    v.to_degrees()
}

fn rad_filter(v: f64) -> f64 {
    v.to_radians()
}

/// 値をブロック形式の YAML 文字列へ変換するフィルタ（`{{ value | toyaml }}` / `{{ value | toyaml(2) }}`）。
/// 引数は、`key:\n{{ value | toyaml(2) }}` のように親キーの下へブロックとして
/// 埋め込む際に、すべての行に付ける字下げ幅（省略時は 0）。
fn toyaml_filter(value: JinjaValue, indent: Option<i64>) -> Result<String, minijinja::Error> {
    let yaml = serde_yaml::to_string(&value)
        .map_err(|e| minijinja::Error::new(minijinja::ErrorKind::InvalidOperation, e.to_string()))?;
    // serde_yaml が付ける先頭の "---" ドキュメント区切りと末尾の改行を取り除く。
    let trimmed = yaml.strip_prefix("---\n").unwrap_or(&yaml).trim_end_matches('\n');

    let width = indent.filter(|n| *n > 0).unwrap_or(0) as usize;
    if width == 0 {
        return Ok(trimmed.to_string());
    }
    let pad = " ".repeat(width);
    Ok(trimmed
        .lines()
        .map(|line| format!("{}{}", pad, line))
        .collect::<Vec<_>>()
        .join("\n"))
}

fn build_jinja_env() -> Environment<'static> {
    let mut env = Environment::new();
    // 未定義変数の真偽判定 (`is defined` 等) は許容しつつ、出力・反復・属性アクセスは
    // エラーにする。テンプレートの typo を早期に検出しつつ、
    // `{% if wp.raw_options.x is defined %}` のような「未設定」判定は自然に書けるようにする。
    env.set_undefined_behavior(UndefinedBehavior::SemiStrict);
    // YAML の字下げを崩さないよう、ブロックタグの前後の改行・空白を詰める。
    env.set_trim_blocks(true);
    env.set_lstrip_blocks(true);
    env.add_filter("toyaml", toyaml_filter);
    env.add_filter("deg", deg_filter);
    env.add_filter("rad", rad_filter);
    env
}

fn render_jinja(template: &str, ctx: &JsonValue) -> Result<String, String> {
    let env = build_jinja_env();
    env.render_str(template, ctx)
        .map_err(|e| format!("Jinja render error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_render_handlebars_is_unchanged() {
        let ctx = json!({ "waypoints": [{"id": "wp1"}] });
        let out = render(TemplateEngine::Handlebars, "{{#each waypoints}}{{id}}{{/each}}", &ctx).unwrap();
        assert_eq!(out, "wp1");
    }

    #[test]
    fn test_render_jinja_loop_and_arithmetic() {
        let ctx = json!({ "waypoints": [{"index": 0, "options": {"speed": 2.0}}] });
        let tmpl = "{% for wp in waypoints %}{{ wp.index }}:{{ wp.options.speed * 1.5 }}\n{% endfor %}";
        let out = render(TemplateEngine::Jinja, tmpl, &ctx).unwrap();
        assert_eq!(out, "0:3.0\n");
    }

    #[test]
    fn test_render_jinja_if_branch() {
        let ctx = json!({ "value": 5 });
        let tmpl = "{% if value > 3 %}big{% else %}small{% endif %}";
        assert_eq!(render(TemplateEngine::Jinja, tmpl, &ctx).unwrap(), "big");
    }

    #[test]
    fn test_render_jinja_tojson_filter_round_trips_through_serde_yaml() {
        // 出力プロパティの並び順を実装詳細として固定しないよう、serde_yaml で読み戻して比較する。
        let ctx = json!({ "actions": [{"type": "wait", "countdown_ms": 3000}] });
        let out = render(TemplateEngine::Jinja, "{{ actions | tojson }}", &ctx).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(parsed, json!([{"type": "wait", "countdown_ms": 3000}]));
    }

    #[test]
    fn test_render_jinja_toyaml_filter_produces_valid_yaml() {
        // "key:\n" の下に、フィルタの出力をブロックとしてそのまま埋め込める字下げになっていることを確認する。
        let ctx = json!({ "actions": [{"type": "wait", "countdown_ms": 3000}, {"type": "amcl_reset"}] });
        let out = render(TemplateEngine::Jinja, "actions:\n{{ actions | toyaml(2) }}", &ctx).unwrap();
        let parsed: serde_json::Value = serde_yaml::from_str(&out).unwrap();
        assert_eq!(
            parsed,
            json!({ "actions": [{"type": "wait", "countdown_ms": 3000}, {"type": "amcl_reset"}] })
        );
    }

    #[test]
    fn test_render_jinja_toyaml_filter_with_no_indent_arg() {
        let ctx = json!({ "x": {"a": 1} });
        let out = render(TemplateEngine::Jinja, "{{ x | toyaml }}", &ctx).unwrap();
        assert_eq!(out, "a: 1");
    }

    #[test]
    fn test_render_jinja_undefined_is_defined_test_does_not_error() {
        let ctx = json!({ "raw_options": {} });
        let tmpl = "{% if raw_options.speed is defined %}yes{% else %}no{% endif %}";
        assert_eq!(render(TemplateEngine::Jinja, tmpl, &ctx).unwrap(), "no");
    }

    #[test]
    fn test_render_jinja_printing_an_undefined_variable_errors() {
        // typo を早期検出できることの確認（SemiStrict の効果）。
        let ctx = json!({});
        let result = render(TemplateEngine::Jinja, "{{ mispelled_var }}", &ctx);
        assert!(result.is_err());
    }

    #[test]
    fn test_render_jinja_deg_and_rad_filters() {
        let ctx = json!({ "yaw": std::f64::consts::PI });
        let out = render(TemplateEngine::Jinja, "{{ yaw | deg | round(1) }}", &ctx).unwrap();
        assert_eq!(out, "180.0");

        let ctx2 = json!({ "deg_val": 180.0 });
        let out2 = render(TemplateEngine::Jinja, "{{ (deg_val | rad) | round(4) }}", &ctx2).unwrap();
        assert_eq!(out2, "3.1416");
    }

    #[test]
    fn test_template_engine_deserializes_and_defaults_to_handlebars() {
        assert_eq!(
            serde_json::from_str::<TemplateEngine>("\"jinja\"").unwrap(),
            TemplateEngine::Jinja
        );
        assert_eq!(
            serde_json::from_str::<TemplateEngine>("\"handlebars\"").unwrap(),
            TemplateEngine::Handlebars
        );
        assert_eq!(TemplateEngine::default(), TemplateEngine::Handlebars);
    }
}
