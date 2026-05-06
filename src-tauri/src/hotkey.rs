use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
use core_graphics::event::{
    CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType,
};
use std::cell::Cell;

/// `kCGKeyboardEventKeycode` from `CGEventTypes.h`. core-graphics exposes
/// `CGEventField` as a bare `u32` rather than an enum, so we use the integer
/// directly.
const KEYBOARD_EVENT_KEYCODE: u32 = 9;

/// macOS device-dependent modifier flag for **Right Option**
/// (`NX_DEVICERALTKEYMASK` from `IOKit/hidsystem/IOLLEvent.h`). Both left and
/// right Option set the standard `kCGEventFlagMaskAlternate`; the device-bit
/// is the only way to tell them apart.
const NX_DEVICERALTKEYMASK: u64 = 0x0000_0040;

/// `kVK_RightOption` from `<Carbon/HIToolbox/Events.h>`.
const KVK_RIGHT_OPTION: i64 = 0x3D;

/// Spawns a dedicated thread that runs a CGEventTap and invokes callbacks when
/// **Right Option** is pressed or released anywhere on the system. Requires
/// macOS Accessibility permission for the binary.
///
/// Implemented directly against CGEventTap (instead of via `rdev`) because
/// `rdev`'s callback eagerly resolves each keycode to a printable string via
/// `TSMGetInputSourceProperty`, which crashes when called off the main thread
/// on macOS 26+.
pub fn spawn_right_option_listener<P, R>(on_press: P, on_release: R)
where
    P: Fn() + Send + 'static,
    R: Fn() + Send + 'static,
{
    std::thread::Builder::new()
        .name("local-whisper-hotkey".into())
        .spawn(move || run(on_press, on_release))
        .expect("spawn hotkey thread");
}

fn run<P: Fn() + 'static, R: Fn() + 'static>(on_press: P, on_release: R) {
    let pressed = Cell::new(false);

    let tap_result = CGEventTap::new(
        CGEventTapLocation::HID,
        CGEventTapPlacement::HeadInsertEventTap,
        CGEventTapOptions::ListenOnly,
        vec![CGEventType::FlagsChanged],
        move |_proxy, _ev_type, event| {
            let keycode = event.get_integer_value_field(KEYBOARD_EVENT_KEYCODE);
            if keycode == KVK_RIGHT_OPTION {
                let raw_flags = event.get_flags().bits();
                let now = (raw_flags & NX_DEVICERALTKEYMASK) != 0;
                if now != pressed.get() {
                    pressed.set(now);
                    if now {
                        on_press();
                    } else {
                        on_release();
                    }
                }
            }
            None
        },
    );

    let tap = match tap_result {
        Ok(t) => t,
        Err(_) => {
            log::error!(
                "CGEventTap creation failed. Grant Accessibility permission to this binary."
            );
            return;
        }
    };

    let source = match tap.mach_port.create_runloop_source(0) {
        Ok(s) => s,
        Err(_) => {
            log::error!("CGEventTap runloop source creation failed");
            return;
        }
    };

    unsafe {
        CFRunLoop::get_current().add_source(&source, kCFRunLoopCommonModes);
    }
    tap.enable();
    CFRunLoop::run_current();
}
