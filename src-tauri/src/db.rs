use anyhow::{Context, Result};
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Serialize, Clone)]
pub struct Dictation {
    pub id: i64,
    pub created_at: i64,
    pub raw_text: String,
    pub cleaned_text: String,
    pub duration_ms: i64,
    pub favorite: bool,
}

/// A user-customisable cleanup profile. The `style_prompt` is appended to
/// the Ollama cleanup user-message as a STYLE block; an empty string means
/// "no override" (the built-in cleanup template runs as-is). The
/// `vocabulary` is stacked with the global vocabulary entries when building
/// Whisper's `initial_prompt`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub style_prompt: String,
    pub vocabulary: String,
    pub created_at: i64,
}

/// Canonical term + spoken/transcribed aliases. Aliases are matched
/// case-insensitively at word boundaries and replaced with the canonical
/// `term` in cleaned dictation text.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VocabularyEntry {
    pub id: i64,
    pub term: String,
    pub aliases: Vec<String>,
    pub created_at: i64,
}

/// Thin wrapper around a single SQLite connection. The connection is held
/// behind a parking_lot Mutex; transcriptions are infrequent enough that a
/// connection pool isn't worth it.
#[derive(Clone)]
pub struct Db {
    conn: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).context("creating db directory")?;
        }
        let conn = Connection::open(path).context("opening sqlite db")?;
        conn.execute_batch(SCHEMA).context("creating db schema")?;
        migrate(&conn).context("running db migrations")?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    // ─── Settings (key/value JSON blob) ─────────────────────────────────────

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock();
        match conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        ) {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    // ─── Dictations ─────────────────────────────────────────────────────────

    pub fn insert(&self, raw: &str, cleaned: &str, duration_ms: i64) -> Result<i64> {
        let now = now_ms();
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO dictations (created_at, raw_text, cleaned_text, duration_ms)
             VALUES (?1, ?2, ?3, ?4)",
            params![now, raw, cleaned, duration_ms],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list(
        &self,
        limit: i64,
        offset: i64,
        favorites_only: bool,
        search: Option<String>,
    ) -> Result<Vec<Dictation>> {
        let conn = self.conn.lock();
        let pattern = search
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| format!("%{}%", s));

        let mut out = Vec::new();
        match (favorites_only, pattern) {
            (true, Some(p)) => {
                let mut stmt = conn.prepare(
                    "SELECT id, created_at, raw_text, cleaned_text, duration_ms, favorite
                     FROM dictations
                     WHERE favorite = 1 AND (cleaned_text LIKE ?1 OR raw_text LIKE ?1)
                     ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
                )?;
                for row in stmt.query_map(params![p, limit, offset], row_to_dictation)? {
                    out.push(row?);
                }
            }
            (true, None) => {
                let mut stmt = conn.prepare(
                    "SELECT id, created_at, raw_text, cleaned_text, duration_ms, favorite
                     FROM dictations
                     WHERE favorite = 1
                     ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
                )?;
                for row in stmt.query_map(params![limit, offset], row_to_dictation)? {
                    out.push(row?);
                }
            }
            (false, Some(p)) => {
                let mut stmt = conn.prepare(
                    "SELECT id, created_at, raw_text, cleaned_text, duration_ms, favorite
                     FROM dictations
                     WHERE cleaned_text LIKE ?1 OR raw_text LIKE ?1
                     ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
                )?;
                for row in stmt.query_map(params![p, limit, offset], row_to_dictation)? {
                    out.push(row?);
                }
            }
            (false, None) => {
                let mut stmt = conn.prepare(
                    "SELECT id, created_at, raw_text, cleaned_text, duration_ms, favorite
                     FROM dictations
                     ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
                )?;
                for row in stmt.query_map(params![limit, offset], row_to_dictation)? {
                    out.push(row?);
                }
            }
        }
        Ok(out)
    }

    pub fn toggle_favorite(&self, id: i64) -> Result<bool> {
        let conn = self.conn.lock();
        let new_value: i64 = conn.query_row(
            "SELECT 1 - favorite FROM dictations WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        conn.execute(
            "UPDATE dictations SET favorite = ?1 WHERE id = ?2",
            params![new_value, id],
        )?;
        Ok(new_value != 0)
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM dictations WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get(&self, id: i64) -> Result<Option<Dictation>> {
        let conn = self.conn.lock();
        match conn.query_row(
            "SELECT id, created_at, raw_text, cleaned_text, duration_ms, favorite
             FROM dictations WHERE id = ?1",
            params![id],
            row_to_dictation,
        ) {
            Ok(d) => Ok(Some(d)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    // ─── Profiles ───────────────────────────────────────────────────────────

    pub fn list_profiles(&self) -> Result<Vec<Profile>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, style_prompt, vocabulary, created_at
             FROM profiles ORDER BY id",
        )?;
        let rows = stmt.query_map([], row_to_profile)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn get_profile(&self, id: i64) -> Result<Option<Profile>> {
        let conn = self.conn.lock();
        match conn.query_row(
            "SELECT id, name, description, style_prompt, vocabulary, created_at
             FROM profiles WHERE id = ?1",
            params![id],
            row_to_profile,
        ) {
            Ok(p) => Ok(Some(p)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn create_profile(
        &self,
        name: &str,
        description: &str,
        style_prompt: &str,
        vocabulary: &str,
    ) -> Result<Profile> {
        let now = now_ms();
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO profiles (name, description, style_prompt, vocabulary, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, description, style_prompt, vocabulary, now],
        )?;
        let id = conn.last_insert_rowid();
        Ok(Profile {
            id,
            name: name.to_string(),
            description: description.to_string(),
            style_prompt: style_prompt.to_string(),
            vocabulary: vocabulary.to_string(),
            created_at: now,
        })
    }

    pub fn update_profile(
        &self,
        id: i64,
        name: &str,
        description: &str,
        style_prompt: &str,
        vocabulary: &str,
    ) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE profiles
             SET name = ?2, description = ?3, style_prompt = ?4, vocabulary = ?5
             WHERE id = ?1",
            params![id, name, description, style_prompt, vocabulary],
        )?;
        Ok(())
    }

    pub fn delete_profile(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ─── Vocabulary entries ─────────────────────────────────────────────────

    pub fn list_vocabulary(&self) -> Result<Vec<VocabularyEntry>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, term, aliases, created_at
             FROM vocabulary_entries ORDER BY term COLLATE NOCASE",
        )?;
        let rows = stmt.query_map([], row_to_vocab)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn create_vocabulary_entry(
        &self,
        term: &str,
        aliases: &[String],
    ) -> Result<VocabularyEntry> {
        let now = now_ms();
        let aliases_json = serde_json::to_string(aliases)?;
        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO vocabulary_entries (term, aliases, created_at)
             VALUES (?1, ?2, ?3)",
            params![term, aliases_json, now],
        )?;
        Ok(VocabularyEntry {
            id: conn.last_insert_rowid(),
            term: term.to_string(),
            aliases: aliases.to_vec(),
            created_at: now,
        })
    }

    pub fn update_vocabulary_entry(
        &self,
        id: i64,
        term: &str,
        aliases: &[String],
    ) -> Result<()> {
        let aliases_json = serde_json::to_string(aliases)?;
        let conn = self.conn.lock();
        conn.execute(
            "UPDATE vocabulary_entries SET term = ?2, aliases = ?3 WHERE id = ?1",
            params![id, term, aliases_json],
        )?;
        Ok(())
    }

    pub fn delete_vocabulary_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock();
        conn.execute(
            "DELETE FROM vocabulary_entries WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }
}

// ─── Row mappers ────────────────────────────────────────────────────────────

fn row_to_dictation(row: &rusqlite::Row) -> rusqlite::Result<Dictation> {
    Ok(Dictation {
        id: row.get(0)?,
        created_at: row.get(1)?,
        raw_text: row.get(2)?,
        cleaned_text: row.get(3)?,
        duration_ms: row.get(4)?,
        favorite: row.get::<_, i64>(5)? != 0,
    })
}

fn row_to_profile(row: &rusqlite::Row) -> rusqlite::Result<Profile> {
    Ok(Profile {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        style_prompt: row.get(3)?,
        vocabulary: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn row_to_vocab(row: &rusqlite::Row) -> rusqlite::Result<VocabularyEntry> {
    let aliases_json: String = row.get(2)?;
    let aliases = serde_json::from_str::<Vec<String>>(&aliases_json).unwrap_or_default();
    Ok(VocabularyEntry {
        id: row.get(0)?,
        term: row.get(1)?,
        aliases,
        created_at: row.get(3)?,
    })
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ─── Schema + migrations ────────────────────────────────────────────────────

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS dictations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    cleaned_text TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dictations_created_at ON dictations(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    style_prompt TEXT NOT NULL DEFAULT '',
    vocabulary TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vocabulary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL UNIQUE,
    aliases TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
);
";

/// (name, description, style_prompt, vocabulary)
type SeedRow = (&'static str, &'static str, &'static str, &'static str);

const DEFAULT_PROFILES: &[SeedRow] = &[
    (
        "Default",
        "Standard cleanup with no style override.",
        "",
        "",
    ),
    (
        "Email",
        "Professional email body — full sentences, proper paragraphs.",
        "STYLE: Format the output as a professional email body. Use full sentences and proper paragraph breaks for distinct topics. Do NOT include greetings (Hi/Hello) or sign-offs (Thanks/Best) unless the speaker explicitly dictates them.",
        "",
    ),
    (
        "Slack",
        "Casual, brief, conversational.",
        "STYLE: Format the output as a brief Slack message. Keep it conversational and short. Lowercase first letters are fine for casual fragments. Avoid full email-like paragraphs.",
        "",
    ),
    (
        "Notes",
        "Bullet points for jotting down thoughts.",
        "STYLE: Format the output as bullet points if the speaker enumerates anything. Otherwise keep as short factual sentences. No flowery language.",
        "",
    ),
    (
        "Code",
        "Preserve technical terms, minimal cleanup.",
        "STYLE: Preserve technical terminology, code keywords, and library names exactly as common developer spellings. Do NOT rewrite for prose. Keep contractions and code-style abbreviations as-is. Output should read like a developer's notes-to-self, not formal prose.",
        "TypeScript, JavaScript, Python, Rust, Go, React, Vue, Svelte, Tauri, async, await, fn, const, let, npm, pnpm, cargo, git, GitHub, API, JSON, YAML, regex, CLI, IDE, SQL, SQLite, Postgres",
    ),
];

/// Run idempotent migrations gated by `PRAGMA user_version`. v1 = seed
/// default profiles + migrate the legacy free-text Settings.vocabulary
/// field into structured vocabulary_entries.
fn migrate(conn: &Connection) -> Result<()> {
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;

    if version < 1 {
        seed_default_profiles(conn)?;
        migrate_vocabulary_from_settings(conn)?;
        conn.execute_batch("PRAGMA user_version = 1")?;
    }

    Ok(())
}

fn seed_default_profiles(conn: &Connection) -> Result<()> {
    let now = now_ms();
    for (name, description, style_prompt, vocabulary) in DEFAULT_PROFILES {
        conn.execute(
            "INSERT OR IGNORE INTO profiles (name, description, style_prompt, vocabulary, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, description, style_prompt, vocabulary, now],
        )?;
    }
    Ok(())
}

/// One-shot migration: split the legacy Settings.vocabulary free-text
/// field on newlines or commas, creating a VocabularyEntry per non-empty
/// line. INSERT OR IGNORE keeps duplicates from erroring.
fn migrate_vocabulary_from_settings(conn: &Connection) -> Result<()> {
    let row = conn.query_row(
        "SELECT value FROM settings WHERE key = 'config'",
        [],
        |r| r.get::<_, String>(0),
    );
    let json_str = match row {
        Ok(s) => s,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(_) => return Ok(()),
    };
    let vocab = parsed
        .get("vocabulary")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    if vocab.is_empty() {
        return Ok(());
    }
    let now = now_ms();
    for raw in vocab.split(['\n', ',']) {
        let term = raw.trim();
        if term.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO vocabulary_entries (term, aliases, created_at)
             VALUES (?1, '[]', ?2)",
            params![term, now],
        )?;
    }
    Ok(())
}
