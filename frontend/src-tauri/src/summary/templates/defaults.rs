/// Embedded default templates using compile-time inclusion
///
/// These templates are bundled into the binary and serve as fallbacks
/// when custom templates are not available.

/// Daily standup template for engineering/product teams
pub const DAILY_STANDUP: &str = include_str!("../../../templates/daily_standup.json");

/// Standard meeting notes template
pub const STANDARD_MEETING: &str = include_str!("../../../templates/standard_meeting.json");

/// Reunión informativa template (anuncios/presentaciones, sin action items forzados)
pub const REUNION_INFORMATIVA: &str = include_str!("../../../templates/reunion_informativa.json");

/// Toma de decisiones template (reuniones enfocadas en decidir un curso de acción)
pub const TOMA_DE_DECISIONES: &str = include_str!("../../../templates/toma_de_decisiones.json");

/// 1:1 / Seguimiento personal template (reuniones individuales de seguimiento)
pub const UNO_A_UNO: &str = include_str!("../../../templates/uno_a_uno.json");

/// Registry of all built-in templates
///
/// Maps template identifiers to their embedded JSON content
pub fn get_builtin_templates() -> Vec<(&'static str, &'static str)> {
    vec![
        ("daily_standup", DAILY_STANDUP),
        ("standard_meeting", STANDARD_MEETING),
        ("reunion_informativa", REUNION_INFORMATIVA),
        ("toma_de_decisiones", TOMA_DE_DECISIONES),
        ("uno_a_uno", UNO_A_UNO),
    ]
}

/// Get a built-in template by identifier
///
/// # Arguments
/// * `id` - Template identifier (e.g., "daily_standup", "standard_meeting")
///
/// # Returns
/// The template JSON content if found, None otherwise
pub fn get_builtin_template(id: &str) -> Option<&'static str> {
    match id {
        "daily_standup" => Some(DAILY_STANDUP),
        "standard_meeting" => Some(STANDARD_MEETING),
        "reunion_informativa" => Some(REUNION_INFORMATIVA),
        "toma_de_decisiones" => Some(TOMA_DE_DECISIONES),
        "uno_a_uno" => Some(UNO_A_UNO),
        _ => None,
    }
}

/// List all built-in template identifiers
pub fn list_builtin_template_ids() -> Vec<&'static str> {
    vec![
        "daily_standup",
        "standard_meeting",
        "reunion_informativa",
        "toma_de_decisiones",
        "uno_a_uno",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_valid_json() {
        for (id, content) in get_builtin_templates() {
            let result = serde_json::from_str::<serde_json::Value>(content);
            assert!(
                result.is_ok(),
                "Built-in template '{}' contains invalid JSON: {:?}",
                id,
                result.err()
            );
        }
    }

    #[test]
    fn test_get_builtin_template() {
        assert!(get_builtin_template("daily_standup").is_some());
        assert!(get_builtin_template("standard_meeting").is_some());
        assert!(get_builtin_template("reunion_informativa").is_some());
        assert!(get_builtin_template("toma_de_decisiones").is_some());
        assert!(get_builtin_template("uno_a_uno").is_some());
        assert!(get_builtin_template("nonexistent").is_none());
    }
}
