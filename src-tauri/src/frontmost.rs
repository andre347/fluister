//! Tracks and activates the macOS frontmost application via AppKit.
//! Used to make "paste from history" land in whatever app the user was in
//! before they opened the history window.
//!
//! Implemented with raw `msg_send!` against the Objective-C runtime so we
//! don't have to chase feature flags across `objc2-app-kit` versions; AppKit
//! is already linked because Tauri's webview uses it.

use objc2::rc::Retained;
use objc2::runtime::{AnyObject, Bool};
use objc2::{class, msg_send, msg_send_id};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TargetApp {
    pub pid: i32,
    pub bundle_id: String,
    pub name: String,
}

pub fn current() -> Option<TargetApp> {
    unsafe {
        let workspace_class = class!(NSWorkspace);
        let workspace: Option<Retained<AnyObject>> =
            msg_send_id![workspace_class, sharedWorkspace];
        let workspace = workspace?;
        let app: Option<Retained<AnyObject>> =
            msg_send_id![&*workspace, frontmostApplication];
        let app = app?;
        let pid: i32 = msg_send![&*app, processIdentifier];
        let bundle_id: Option<Retained<AnyObject>> = msg_send_id![&*app, bundleIdentifier];
        let name: Option<Retained<AnyObject>> = msg_send_id![&*app, localizedName];
        Some(TargetApp {
            pid,
            bundle_id: nsstring_to_string(bundle_id),
            name: nsstring_to_string(name),
        })
    }
}

pub fn activate(pid: i32) -> bool {
    unsafe {
        let cls = class!(NSRunningApplication);
        let app: Option<Retained<AnyObject>> =
            msg_send_id![cls, runningApplicationWithProcessIdentifier: pid];
        match app {
            None => false,
            Some(app) => {
                let activated: Bool = msg_send![&*app, activate];
                activated.as_bool()
            }
        }
    }
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

pub const SELF_BUNDLE_ID: &str = "com.fluister.app";

pub fn is_self(app: &TargetApp) -> bool {
    app.bundle_id == SELF_BUNDLE_ID
}
