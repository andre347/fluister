#!/bin/sh
# Tauri `build.runner` wrapper.
#
# Why this exists: the default dev binary is *ad-hoc* signed, and macOS ties
# TCC grants (Input Monitoring, Accessibility) to the binary's signing
# identity. Ad-hoc signing produces a fresh identity on every compile, so the
# OS silently drops those grants after each rebuild — meaning the global
# hotkey stops firing until you re-grant Input Monitoring. Re-signing the dev
# binary with a *stable* local self-signed identity ("Fluister Dev") keeps the
# identity (and the pinned identifier) constant, so a one-time grant persists
# across rebuilds.
#
# This is dev-only: release builds (`tauri build`) re-sign during bundling per
# tauri.conf.json > bundle.macOS, and this script only touches the debug
# binary. If the "Fluister Dev" identity isn't present (e.g. CI, a fresh
# clone), codesign fails harmlessly and the build proceeds ad-hoc as before.
#
# Setup to create the identity is documented in README / the cert lives in the
# login keychain. cwd here is src-tauri/ (Tauri runs the runner from there).

cargo "$@"
status=$?

if [ "$status" -eq 0 ] && [ -f target/debug/fluister ]; then
  if codesign --force --identifier com.fluister.app --sign "Fluister Dev" \
      target/debug/fluister >/dev/null 2>&1; then
    echo "[sign-dev] re-signed target/debug/fluister with Fluister Dev" >&2
  fi
fi

exit $status
