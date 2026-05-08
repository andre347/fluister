//! Enumerates installed macOS applications for the profile-binding picker.
//!
//! Walks /Applications + /System/Applications + ~/Applications and asks
//! NSBundle for the bundle identifier and display name of each .app
//! bundle. Skips bundles that don't expose a `CFBundleIdentifier` (those
//! are typically uninstaller helpers, prefpanes, or partial installs that
//! aren't useful as profile targets anyway).
//!
//! No icons in v1 — the UI renders a generic glyph. Pulling NSImage and
//! re-encoding as a data URL is its own thing; deferred until the picker
//! becomes a frequent-enough flow to need it.

use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2::{class, msg_send, msg_send_id};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct InstalledApp {
    /// macOS bundle identifier, e.g. "com.apple.mail". Stable across
    /// renames and version bumps; the right thing to persist.
    pub bundle_id: String,
    /// User-facing name from CFBundleDisplayName, falling back to the .app
    /// directory name without the suffix.
    pub name: String,
}

/// Roots scanned for .app bundles. Order matters for deduplication: when a
/// user installs an app over a system-shipped one (e.g. they've put a
/// newer Safari Technology Preview in /Applications next to the system
/// Safari in /System/Applications), the user copy wins because it shows up
/// first in this list.
fn scan_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    roots.push(PathBuf::from("/Applications"));
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Applications"));
    }
    roots.push(PathBuf::from("/System/Applications"));
    roots
}

pub fn list_installed() -> Vec<InstalledApp> {
    // Bundle id → app. HashMap for the dedup; first-seen wins, matching
    // the priority order returned by `scan_roots`.
    let mut seen: HashMap<String, InstalledApp> = HashMap::new();

    for root in scan_roots() {
        scan_dir(&root, &mut seen, 0);
    }

    let mut apps: Vec<InstalledApp> = seen.into_values().collect();
    apps.sort_by_key(|a| a.name.to_lowercase());
    apps
}

/// Recursively walk a directory looking for .app bundles. Limits to two
/// levels of subdirectories so /Applications/Utilities is reached but a
/// deeply-nested project tree never gets descended into. The .app
/// bundles themselves are not recursed — they're just inspected.
fn scan_dir(dir: &Path, out: &mut HashMap<String, InstalledApp>, depth: u32) {
    if depth > 2 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        if name.ends_with(".app") {
            if let Some(app) = inspect_bundle(&path) {
                out.entry(app.bundle_id.clone()).or_insert(app);
            }
            continue;
        }
        // Subdirectory — recurse one more level (e.g. /Applications/Utilities).
        let Ok(meta) = entry.metadata() else { continue; };
        if meta.is_dir() {
            scan_dir(&path, out, depth + 1);
        }
    }
}

fn inspect_bundle(path: &Path) -> Option<InstalledApp> {
    unsafe {
        let path_str = path.to_str()?;
        let cls = class!(NSBundle);
        let nspath: Retained<AnyObject> = nsstring_from(path_str)?;
        let bundle: Option<Retained<AnyObject>> =
            msg_send_id![cls, bundleWithPath: &*nspath];
        let bundle = bundle?;

        let bundle_id_obj: Option<Retained<AnyObject>> =
            msg_send_id![&*bundle, bundleIdentifier];
        let bundle_id = nsstring_to_string(bundle_id_obj);
        if bundle_id.is_empty() {
            return None;
        }

        // CFBundleDisplayName falls back to CFBundleName falls back to the
        // .app directory name. Most apps have one of the first two.
        let display_key: Retained<AnyObject> = nsstring_from("CFBundleDisplayName")?;
        let name_key: Retained<AnyObject> = nsstring_from("CFBundleName")?;
        let display: Option<Retained<AnyObject>> =
            msg_send_id![&*bundle, objectForInfoDictionaryKey: &*display_key];
        let name_obj: Option<Retained<AnyObject>> =
            msg_send_id![&*bundle, objectForInfoDictionaryKey: &*name_key];
        let mut name = nsstring_to_string(display);
        if name.is_empty() {
            name = nsstring_to_string(name_obj);
        }
        if name.is_empty() {
            name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
        }

        Some(InstalledApp { bundle_id, name })
    }
}

unsafe fn nsstring_from(s: &str) -> Option<Retained<AnyObject>> {
    let cls = class!(NSString);
    // -[NSString stringWithUTF8String:] copies the bytes, so we don't have
    // to keep `s` alive past the call.
    let cstr = std::ffi::CString::new(s).ok()?;
    let obj: Option<Retained<AnyObject>> =
        msg_send_id![cls, stringWithUTF8String: cstr.as_ptr()];
    obj
}

unsafe fn nsstring_to_string(s: Option<Retained<AnyObject>>) -> String {
    let Some(s) = s else { return String::new(); };
    let utf8: *const std::ffi::c_char = msg_send![&*s, UTF8String];
    if utf8.is_null() {
        return String::new();
    }
    std::ffi::CStr::from_ptr(utf8)
        .to_string_lossy()
        .into_owned()
}
