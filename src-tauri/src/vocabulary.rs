//! Post-cleanup alias replacement.
//!
//! After Ollama cleanup, sweep the cleaned text and replace each
//! VocabularyEntry's aliases with its canonical term. Matches are
//! case-insensitive at word boundaries, so "type script" / "Type Script"
//! / "TYPE SCRIPT" all become "TypeScript" without touching unrelated
//! substrings.

use regex::{Regex, RegexBuilder};

use crate::db::VocabularyEntry;

pub fn apply_replacements(text: &str, entries: &[VocabularyEntry]) -> String {
    let mut out = text.to_string();
    for entry in entries {
        for alias in &entry.aliases {
            let alias = alias.trim();
            if alias.is_empty() {
                continue;
            }
            // \b word boundaries handle most ASCII cases. For Unicode
            // alphabetic terms regex's default behaviour is good enough —
            // failures here are non-fatal so we skip and continue.
            let pattern = format!(r"\b{}\b", regex::escape(alias));
            let Ok(re) = RegexBuilder::new(&pattern).case_insensitive(true).build() else {
                continue;
            };
            out = re.replace_all(&out, &entry.term as &str).to_string();
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(term: &str, aliases: &[&str]) -> VocabularyEntry {
        VocabularyEntry {
            id: 0,
            term: term.into(),
            aliases: aliases.iter().map(|s| (*s).into()).collect(),
            created_at: 0,
            ulid: String::new(),
        }
    }

    #[test]
    fn replaces_word_boundaries_only() {
        let entries = vec![entry("TypeScript", &["type script", "typescript"])];
        let out = apply_replacements("I love type script and typescript.", &entries);
        assert_eq!(out, "I love TypeScript and TypeScript.");
    }

    #[test]
    fn case_insensitive_match() {
        let entries = vec![entry("TypeScript", &["type script"])];
        let out = apply_replacements("Type Script is great.", &entries);
        assert_eq!(out, "TypeScript is great.");
    }

    #[test]
    fn skips_substrings() {
        let entries = vec![entry("Type", &["typ"])];
        let out = apply_replacements("type typing typo", &entries);
        // No match — "typ" isn't a standalone word in any of these.
        assert_eq!(out, "type typing typo");
    }

    #[test]
    fn empty_aliases_are_skipped() {
        let entries = vec![entry("X", &["", "  "])];
        let out = apply_replacements("hello world", &entries);
        assert_eq!(out, "hello world");
    }
}

// Silence dead-code warnings on Regex when feature flags exclude tests.
#[allow(dead_code)]
fn _unused_regex_marker(_re: &Regex) {}
