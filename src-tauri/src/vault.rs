//! Vault file format — profiles + vocabulary stored as markdown files
//! in the user's Fluister vault directory.
//!
//! Layout:
//!   <vault>/
//!     .fluister-meta.yml       — active profile pointer, format version
//!     profiles/
//!       <slug>.md              — one markdown file per profile
//!     vocabulary/
//!       Global.md              — single markdown table for all terms
//!
//! The vault is **canonical** — the in-app SQLite cache is derived from
//! these files. ULIDs in frontmatter are stable across cache rebuilds and
//! survive multi-machine sync (auto-increment integers don't).
//!
//! This module is pure file IO + parsing. It owns no state and never
//! touches SQLite. Higher layers (`db.rs`, `lib.rs`) reconcile the two.

use anyhow::{anyhow, bail, Context, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use ulid::Ulid;

// ─── Public types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultProfile {
    pub ulid: Ulid,
    pub name: String,
    pub description: String,
    pub style_prompt: String,
    pub vocabulary: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultVocab {
    pub ulid: Ulid,
    pub term: String,
    pub aliases: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VaultMeta {
    /// ULID of the active profile, or None for "fall back to Default".
    pub active_profile_ulid: Option<String>,
    /// Format version. Bumped when the on-disk format changes in a way
    /// that older app builds wouldn't understand.
    #[serde(default = "default_version")]
    pub version: u32,
}

fn default_version() -> u32 {
    1
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

pub fn profiles_dir(root: &Path) -> PathBuf {
    root.join("profiles")
}
pub fn vocabulary_dir(root: &Path) -> PathBuf {
    root.join("vocabulary")
}
pub fn meta_path(root: &Path) -> PathBuf {
    root.join(".fluister-meta.yml")
}
pub fn vocabulary_global_path(root: &Path) -> PathBuf {
    vocabulary_dir(root).join("Global.md")
}

/// Initialise empty vault directories. Idempotent.
pub fn ensure_layout(root: &Path) -> Result<()> {
    fs::create_dir_all(profiles_dir(root)).context("creating profiles dir")?;
    fs::create_dir_all(vocabulary_dir(root)).context("creating vocabulary dir")?;
    Ok(())
}

// ─── Slug + filename helpers ────────────────────────────────────────────────

/// Convert a human profile name to a filesystem-safe filename stem.
/// Preserves case + spaces (Obsidian-style: "Quick Reply.md"), strips
/// path separators and other unsafe chars, collapses runs of whitespace.
pub fn slug(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_space = false;
    for ch in name.chars() {
        let safe = match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => false,
            c if c.is_control() => false,
            _ => true,
        };
        if !safe {
            continue;
        }
        if ch.is_whitespace() {
            if !last_space {
                out.push(' ');
                last_space = true;
            }
        } else {
            out.push(ch);
            last_space = false;
        }
    }
    let trimmed = out.trim().trim_matches('.').to_string();
    if trimmed.is_empty() {
        "Untitled".into()
    } else {
        trimmed
    }
}

pub fn profile_filename(name: &str) -> String {
    format!("{}.md", slug(name))
}

// ─── Atomic write ───────────────────────────────────────────────────────────

/// Write to `<path>.tmp`, fsync, then rename over the target. Renames are
/// atomic on local filesystems on macOS so readers either see the old or
/// the new content, never a half-written file. Important for sync clients
/// (iCloud, Dropbox) that watch for renames.
fn atomic_write(path: &Path, contents: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("creating parent dir")?;
    }
    let tmp = path.with_extension("tmp");
    {
        let mut f = fs::File::create(&tmp).context("creating tmp file")?;
        f.write_all(contents.as_bytes()).context("writing tmp file")?;
        f.sync_all().context("fsync tmp file")?;
    }
    fs::rename(&tmp, path).context("rename tmp -> target")?;
    Ok(())
}

// ─── Profile I/O ────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct ProfileFrontmatter {
    id: String,
    name: String,
    #[serde(default)]
    description: String,
    created: String,
}

const SECTION_STYLE: &str = "Style prompt";
const SECTION_VOCABULARY: &str = "Vocabulary seeds";

pub fn write_profile(root: &Path, profile: &VaultProfile) -> Result<PathBuf> {
    let path = profiles_dir(root).join(profile_filename(&profile.name));
    let body = format_profile(profile);
    atomic_write(&path, &body)?;
    Ok(path)
}

pub fn delete_profile(root: &Path, name: &str) -> Result<()> {
    let path = profiles_dir(root).join(profile_filename(name));
    if path.exists() {
        fs::remove_file(&path).context("removing profile file")?;
    }
    Ok(())
}

pub fn read_profile(path: &Path) -> Result<VaultProfile> {
    let raw = fs::read_to_string(path).context("reading profile file")?;
    parse_profile(&raw).with_context(|| format!("parsing {}", path.display()))
}

pub fn list_profiles(root: &Path) -> Result<Vec<(PathBuf, VaultProfile)>> {
    let dir = profiles_dir(root);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).context("reading profiles dir")? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        match read_profile(&path) {
            Ok(p) => out.push((path, p)),
            Err(err) => log::warn!("skipping malformed profile {}: {err}", path.display()),
        }
    }
    out.sort_by(|a, b| a.1.name.to_lowercase().cmp(&b.1.name.to_lowercase()));
    Ok(out)
}

fn format_profile(p: &VaultProfile) -> String {
    let fm = ProfileFrontmatter {
        id: p.ulid.to_string(),
        name: p.name.clone(),
        description: p.description.clone(),
        created: p.created_at.to_rfc3339_opts(SecondsFormat::Secs, true),
    };
    let yaml = serde_yaml::to_string(&fm).expect("frontmatter serialises");
    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(&yaml);
    out.push_str("---\n\n");
    out.push_str(&format!("## {SECTION_STYLE}\n\n"));
    if p.style_prompt.is_empty() {
        out.push_str("_No style override._\n");
    } else {
        out.push_str(p.style_prompt.trim_end());
        out.push('\n');
    }
    out.push_str(&format!("\n## {SECTION_VOCABULARY}\n\n"));
    if p.vocabulary.is_empty() {
        out.push_str("_None._\n");
    } else {
        out.push_str(p.vocabulary.trim_end());
        out.push('\n');
    }
    out
}

fn parse_profile(raw: &str) -> Result<VaultProfile> {
    let (frontmatter, body) = split_frontmatter(raw)?;
    let fm: ProfileFrontmatter = serde_yaml::from_str(frontmatter)
        .context("parsing profile frontmatter")?;
    let ulid = Ulid::from_string(&fm.id).map_err(|e| anyhow!("invalid ulid: {e}"))?;
    let created_at = DateTime::parse_from_rfc3339(&fm.created)
        .map_err(|e| anyhow!("invalid created timestamp: {e}"))?
        .with_timezone(&Utc);

    let mut style_prompt = read_section(body, SECTION_STYLE).unwrap_or_default();
    let mut vocabulary = read_section(body, SECTION_VOCABULARY).unwrap_or_default();

    // Round-trip the "_No style override._" sentinel back to empty.
    if style_prompt.trim() == "_No style override._" {
        style_prompt.clear();
    }
    if vocabulary.trim() == "_None._" {
        vocabulary.clear();
    }

    Ok(VaultProfile {
        ulid,
        name: fm.name,
        description: fm.description,
        style_prompt,
        vocabulary,
        created_at,
    })
}

// ─── Vocabulary I/O ─────────────────────────────────────────────────────────

pub fn write_vocabulary(root: &Path, entries: &[VaultVocab]) -> Result<PathBuf> {
    let path = vocabulary_global_path(root);
    let body = format_vocabulary(entries);
    atomic_write(&path, &body)?;
    Ok(path)
}

pub fn read_vocabulary(root: &Path) -> Result<Vec<VaultVocab>> {
    let path = vocabulary_global_path(root);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).context("reading vocabulary file")?;
    parse_vocabulary(&raw).with_context(|| format!("parsing {}", path.display()))
}

fn format_vocabulary(entries: &[VaultVocab]) -> String {
    let mut out = String::new();
    out.push_str("---\nscope: global\n---\n\n");
    out.push_str("# Vocabulary\n\n");
    out.push_str(
        "Each row is a canonical term plus zero or more spoken aliases that should be normalised to it.\n\n",
    );
    out.push_str("| Term | Aliases | ULID | Created |\n");
    out.push_str("|------|---------|------|---------|\n");
    for v in entries {
        let term_cell = escape_cell(&v.term);
        let aliases_cell = escape_cell(&v.aliases.join(", "));
        let ulid_cell = v.ulid.to_string();
        let created_cell = v.created_at.to_rfc3339_opts(SecondsFormat::Secs, true);
        out.push_str(&format!(
            "| {term_cell} | {aliases_cell} | {ulid_cell} | {created_cell} |\n"
        ));
    }
    out
}

fn parse_vocabulary(raw: &str) -> Result<Vec<VaultVocab>> {
    // Frontmatter is optional for vocab — accept files written by an older
    // build that omitted it, and skip whatever the user might have prepended.
    let body = match split_frontmatter(raw) {
        Ok((_, body)) => body,
        Err(_) => raw,
    };
    let mut out = Vec::new();
    let mut found_header = false;
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("|") && trimmed.contains("Term") && trimmed.contains("Aliases") {
            found_header = true;
            continue;
        }
        if !found_header {
            continue;
        }
        // Skip the alignment row "|---|---|"
        if trimmed.chars().all(|c| matches!(c, '|' | '-' | ':' | ' ')) {
            continue;
        }
        if !trimmed.starts_with('|') {
            // First non-table line means the table is over.
            if !out.is_empty() {
                break;
            }
            continue;
        }
        let cells = split_cells(trimmed);
        if cells.len() < 4 {
            continue;
        }
        let term = unescape_cell(cells[0].trim());
        if term.is_empty() {
            continue;
        }
        let aliases: Vec<String> = if cells[1].trim().is_empty() {
            Vec::new()
        } else {
            unescape_cell(cells[1].trim())
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        };
        let ulid = Ulid::from_string(cells[2].trim())
            .map_err(|e| anyhow!("invalid ulid in row {term:?}: {e}"))?;
        let created_at = DateTime::parse_from_rfc3339(cells[3].trim())
            .map_err(|e| anyhow!("invalid timestamp in row {term:?}: {e}"))?
            .with_timezone(&Utc);

        out.push(VaultVocab {
            ulid,
            term,
            aliases,
            created_at,
        });
    }
    Ok(out)
}

// ─── Meta I/O ───────────────────────────────────────────────────────────────

pub fn read_meta(root: &Path) -> Result<VaultMeta> {
    let path = meta_path(root);
    if !path.exists() {
        return Ok(VaultMeta::default());
    }
    let raw = fs::read_to_string(&path).context("reading meta file")?;
    let meta: VaultMeta = serde_yaml::from_str(&raw).context("parsing meta")?;
    Ok(meta)
}

pub fn write_meta(root: &Path, meta: &VaultMeta) -> Result<()> {
    let path = meta_path(root);
    let yaml = serde_yaml::to_string(meta).context("serialising meta")?;
    atomic_write(&path, &yaml)?;
    Ok(())
}

// ─── Markdown helpers ───────────────────────────────────────────────────────

fn split_frontmatter(raw: &str) -> Result<(&str, &str)> {
    let raw = raw.strip_prefix('\u{feff}').unwrap_or(raw);
    let raw = raw.trim_start_matches('\n');
    let stripped = raw
        .strip_prefix("---\n")
        .or_else(|| raw.strip_prefix("---\r\n"))
        .ok_or_else(|| anyhow!("missing leading --- frontmatter delimiter"))?;
    if let Some(end) = stripped.find("\n---\n").or_else(|| stripped.find("\n---\r\n")) {
        let frontmatter = &stripped[..end];
        let after = &stripped[end + 1..];
        let body = after
            .strip_prefix("---\n")
            .or_else(|| after.strip_prefix("---\r\n"))
            .unwrap_or(after);
        Ok((frontmatter, body.trim_start_matches('\n')))
    } else {
        bail!("missing closing --- frontmatter delimiter")
    }
}

/// Pull the body of an `## <heading>` section. Returns the contents
/// trimmed of leading/trailing whitespace, or None if the heading is
/// absent. Stops at the next `## ` heading or end of input.
fn read_section(body: &str, heading: &str) -> Option<String> {
    let needle = format!("## {heading}");
    let mut iter = body.split_inclusive('\n');
    let mut found = false;
    let mut out = String::new();
    for line in iter.by_ref() {
        if !found {
            if line.trim() == needle {
                found = true;
            }
            continue;
        }
        if line.starts_with("## ") {
            // Leftover line goes back — but split_inclusive drops it from
            // future iter, so stop here.
            break;
        }
        out.push_str(line);
    }
    if found {
        Some(out.trim().to_string())
    } else {
        None
    }
}

/// Markdown table cells use `|` as separator; escape literal pipes and
/// strip newlines (which would break the row).
fn escape_cell(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('|', "\\|")
        .replace('\n', " ")
}

/// Split a markdown table row into cells, treating `\|` as a literal
/// pipe (not a separator). Strips the leading/trailing `|` framing.
fn split_cells(row: &str) -> Vec<String> {
    let row = row.trim_start_matches('|').trim_end_matches('|');
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut chars = row.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(&next) = chars.peek() {
                if next == '|' || next == '\\' {
                    current.push(ch);
                    current.push(next);
                    chars.next();
                    continue;
                }
            }
            current.push(ch);
        } else if ch == '|' {
            cells.push(std::mem::take(&mut current));
        } else {
            current.push(ch);
        }
    }
    cells.push(current);
    cells
}

fn unescape_cell(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('|') => out.push('|'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(ch);
        }
    }
    out
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn ulid_for(byte: u8) -> Ulid {
        // Deterministic ULID for snapshot stability — bytes 0..16 = byte.
        Ulid::from_bytes([byte; 16])
    }

    fn fixed_ts() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 5, 7, 10, 42, 0).unwrap()
    }

    #[test]
    fn slug_preserves_human_names() {
        assert_eq!(slug("Email"), "Email");
        assert_eq!(slug("Quick Reply"), "Quick Reply");
        assert_eq!(slug("Code/Notes"), "CodeNotes");
        assert_eq!(slug("  spaced   out  "), "spaced out");
        assert_eq!(slug("..."), "Untitled");
        assert_eq!(slug(""), "Untitled");
        assert_eq!(slug("path:bad"), "pathbad");
    }

    #[test]
    fn profile_round_trip() {
        let p = VaultProfile {
            ulid: ulid_for(1),
            name: "Email".into(),
            description: "Polished email body".into(),
            style_prompt: "STYLE: Format as a polite reply.".into(),
            vocabulary: "TypeScript, Tauri".into(),
            created_at: fixed_ts(),
        };
        let raw = format_profile(&p);
        let parsed = parse_profile(&raw).unwrap();
        assert_eq!(parsed, p);
    }

    #[test]
    fn profile_round_trip_empty_sections() {
        let p = VaultProfile {
            ulid: ulid_for(2),
            name: "Default".into(),
            description: String::new(),
            style_prompt: String::new(),
            vocabulary: String::new(),
            created_at: fixed_ts(),
        };
        let raw = format_profile(&p);
        let parsed = parse_profile(&raw).unwrap();
        assert_eq!(parsed, p);
    }

    #[test]
    fn vocab_round_trip() {
        let entries = vec![
            VaultVocab {
                ulid: ulid_for(1),
                term: "TypeScript".into(),
                aliases: vec!["type script".into(), "typescript".into()],
                created_at: fixed_ts(),
            },
            VaultVocab {
                ulid: ulid_for(2),
                term: "Tauri".into(),
                aliases: vec![],
                created_at: fixed_ts(),
            },
        ];
        let raw = format_vocabulary(&entries);
        let parsed = parse_vocabulary(&raw).unwrap();
        assert_eq!(parsed, entries);
    }

    #[test]
    fn vocab_handles_pipes_in_terms() {
        let entries = vec![VaultVocab {
            ulid: ulid_for(1),
            term: "a|b".into(),
            aliases: vec!["x|y".into()],
            created_at: fixed_ts(),
        }];
        let raw = format_vocabulary(&entries);
        assert!(raw.contains("a\\|b"));
        let parsed = parse_vocabulary(&raw).unwrap();
        assert_eq!(parsed, entries);
    }

    #[test]
    fn vault_layout_writes_atomically() {
        let dir = tempfile_dir();
        let p = VaultProfile {
            ulid: ulid_for(1),
            name: "Email".into(),
            description: "x".into(),
            style_prompt: "STYLE: hi".into(),
            vocabulary: String::new(),
            created_at: fixed_ts(),
        };
        ensure_layout(&dir).unwrap();
        let path = write_profile(&dir, &p).unwrap();
        assert!(path.ends_with("profiles/Email.md"));
        let parsed = read_profile(&path).unwrap();
        assert_eq!(parsed, p);
    }

    #[test]
    fn list_profiles_sorts_case_insensitive() {
        let dir = tempfile_dir();
        ensure_layout(&dir).unwrap();
        for name in ["zeta", "Alpha", "beta"] {
            write_profile(
                &dir,
                &VaultProfile {
                    ulid: Ulid::new(),
                    name: name.into(),
                    description: String::new(),
                    style_prompt: String::new(),
                    vocabulary: String::new(),
                    created_at: fixed_ts(),
                },
            )
            .unwrap();
        }
        let listed = list_profiles(&dir).unwrap();
        let names: Vec<&str> = listed.iter().map(|(_, p)| p.name.as_str()).collect();
        assert_eq!(names, vec!["Alpha", "beta", "zeta"]);
    }

    #[test]
    fn meta_round_trip() {
        let dir = tempfile_dir();
        let mut meta = VaultMeta::default();
        meta.active_profile_ulid = Some(ulid_for(7).to_string());
        meta.version = 1;
        write_meta(&dir, &meta).unwrap();
        let read = read_meta(&dir).unwrap();
        assert_eq!(read.active_profile_ulid, meta.active_profile_ulid);
        assert_eq!(read.version, meta.version);
    }

    fn tempfile_dir() -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!(
            "fluister-vault-test-{}",
            std::process::id() as u64 * 1_000_000
                + rand_seed()
        ));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn rand_seed() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }
}
