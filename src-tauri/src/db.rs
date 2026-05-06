use anyhow::{Context, Result};
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::Serialize;
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
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

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
}

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

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

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
";
