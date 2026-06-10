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
        let term = entry.term.trim();
        if term.is_empty() {
            continue;
        }
        // The canonical term is treated as its own (case-insensitive) alias, so
        // a correctly-spelled but mis-cased hit — "posthog" / "Posthog" — still
        // normalises to the canonical casing "PostHog" without the user having
        // to list it. True mishears (e.g. "posthoog") still need an explicit
        // alias since they aren't the same letters.
        let variants = std::iter::once(term).chain(entry.aliases.iter().map(|a| a.trim()));
        for variant in variants {
            if variant.is_empty() {
                continue;
            }
            // \b word boundaries handle most ASCII cases. For Unicode
            // alphabetic terms regex's default behaviour is good enough —
            // failures here are non-fatal so we skip and continue.
            let pattern = format!(r"\b{}\b", regex::escape(variant));
            let Ok(re) = RegexBuilder::new(&pattern).case_insensitive(true).build() else {
                continue;
            };
            out = re.replace_all(&out, term).to_string();
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
        // "typ" is never a standalone word, so it never matches. The standalone
        // "type" normalises to the canonical casing "Type" (self-alias); the
        // substrings in "typing"/"typo" are untouched.
        assert_eq!(out, "Type typing typo");
    }

    #[test]
    fn term_normalises_its_own_casing() {
        // The PostHog case: no aliases needed for a right-spelling/wrong-casing
        // hit — the canonical term is its own case-insensitive alias.
        let entries = vec![entry("PostHog", &[])];
        let out = apply_replacements("I joined posthog, then Posthog grew.", &entries);
        assert_eq!(out, "I joined PostHog, then PostHog grew.");
    }

    #[test]
    fn explicit_alias_handles_true_mishears() {
        // "posthoog" is a different spelling, so it needs an explicit alias.
        let entries = vec![entry("PostHog", &["posthoog", "post hog"])];
        let out = apply_replacements("started at PostHoog using post hog", &entries);
        assert_eq!(out, "started at PostHog using PostHog");
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
