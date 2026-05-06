//! macOS permission helpers — used by the onboarding window to render live
//! status rows for Microphone and Accessibility, and to deep-link the user
//! to the right System Settings panel.

use serde::Serialize;

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

/// `true` when the binary is in System Settings → Privacy & Security →
/// Accessibility *and* enabled. Required for the global hotkey CGEventTap
/// and for synthesising ⌘V on paste.
pub fn accessibility_granted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MicStatus {
    NotDetermined,
    Restricted,
    Denied,
    Authorized,
}

/// Reads the macOS-level mic authorization state via AVCaptureDevice.
///
/// Implemented via `objc2::msg_send!` so we don't need to link AVFoundation
/// statically — `class!()` resolves the class at runtime, and AVFoundation
/// is loaded by Tauri's webview anyway.
pub fn microphone_status() -> MicStatus {
    unsafe {
        use objc2::class;
        use objc2::rc::Retained;
        use objc2::runtime::AnyObject;
        use objc2::{msg_send, msg_send_id};

        let av_cls = class!(AVCaptureDevice);
        let nsstring_cls = class!(NSString);

        // AVMediaTypeAudio == "soun"
        let cstr = std::ffi::CString::new("soun").unwrap();
        let media_type: Option<Retained<AnyObject>> =
            msg_send_id![nsstring_cls, stringWithUTF8String: cstr.as_ptr()];
        let Some(media_type) = media_type else {
            return MicStatus::NotDetermined;
        };

        let status: i64 = msg_send![av_cls, authorizationStatusForMediaType: &*media_type];
        match status {
            0 => MicStatus::NotDetermined,
            1 => MicStatus::Restricted,
            2 => MicStatus::Denied,
            3 => MicStatus::Authorized,
            _ => MicStatus::NotDetermined,
        }
    }
}

/// Triggers the system mic-permission prompt the first time it's called.
/// On subsequent calls, no-ops (returns whatever the current status is).
pub fn request_microphone() {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    // Quickest reliable trigger: open and immediately drop a tiny input
    // stream. macOS shows the prompt the first time we touch the mic in
    // this binary's lifetime.
    let host = cpal::default_host();
    let Some(device) = host.default_input_device() else { return; };
    let Ok(supported) = device.default_input_config() else { return; };
    let stream_cfg: cpal::StreamConfig = supported.clone().into();
    let format = supported.sample_format();

    let stream = match format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &stream_cfg,
            |_data: &[f32], _: &_| {},
            |_e| {},
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &stream_cfg,
            |_data: &[i16], _: &_| {},
            |_e| {},
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &stream_cfg,
            |_data: &[u16], _: &_| {},
            |_e| {},
            None,
        ),
        _ => return,
    };
    let Ok(stream) = stream else { return; };
    let _ = stream.play();
    std::thread::sleep(std::time::Duration::from_millis(80));
    drop(stream);
}

/// Opens a specific Privacy & Security panel in System Settings.
pub fn open_privacy_panel(panel: &str) -> std::io::Result<()> {
    let url = match panel {
        "microphone"    => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
        "accessibility" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        _ => "x-apple.systempreferences:com.apple.preference.security",
    };
    std::process::Command::new("open").arg(url).spawn().map(|_| ())
}
