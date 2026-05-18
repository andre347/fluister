#!/usr/bin/env bash
# Fluister installer. Downloads the latest release DMG over curl (which
# does not set the macOS quarantine flag), mounts it, copies Fluister.app
# into /Applications, and unmounts. Launches normally with no Gatekeeper
# "damaged" or "unidentified developer" prompts.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/andre347/fluister/main/scripts/install.sh | bash

set -euo pipefail

readonly REPO="andre347/fluister"
readonly DMG_ASSET="Fluister_aarch64.dmg"
readonly DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${DMG_ASSET}"

# Pretty output helpers — no colour codes if we're not on a TTY.
if [ -t 1 ]; then
  bold=$(tput bold)
  dim=$(tput dim)
  reset=$(tput sgr0)
else
  bold="" dim="" reset=""
fi

say()  { printf '%s\n' "${bold}==>${reset} $*"; }
note() { printf '%s\n' "${dim}    $*${reset}"; }
fail() { printf '%s\n' "${bold}!!  $*${reset}" >&2; exit 1; }

# Sanity checks.
[ "$(uname -s)" = "Darwin" ] || fail "Fluister only runs on macOS."

arch=$(uname -m)
if [ "$arch" != "arm64" ]; then
  fail "Fluister requires an Apple Silicon Mac (M1 or later). Detected: $arch."
fi

os_major=$(sw_vers -productVersion | cut -d. -f1)
if [ "$os_major" -lt 11 ]; then
  fail "Fluister requires macOS 11 or later. Detected: $(sw_vers -productVersion)."
fi

# Temp workspace. Cleaned up on exit, even on failure.
tmp_dir=$(mktemp -d -t fluister-install)
mount_point="${tmp_dir}/mount"
dmg_path="${tmp_dir}/Fluister.dmg"

cleanup() {
  if [ -d "$mount_point" ]; then
    hdiutil detach -quiet "$mount_point" 2>/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

say "Downloading Fluister"
note "$DOWNLOAD_URL"
if ! curl -fL --progress-bar -o "$dmg_path" "$DOWNLOAD_URL"; then
  fail "Download failed. Check your connection and that a release exists."
fi

say "Mounting"
mkdir -p "$mount_point"
hdiutil attach -nobrowse -quiet -mountpoint "$mount_point" "$dmg_path" \
  || fail "Failed to mount the DMG."

src_app="${mount_point}/Fluister.app"
[ -d "$src_app" ] || fail "Fluister.app not found inside the DMG."

dest_app="/Applications/Fluister.app"
if [ -d "$dest_app" ]; then
  say "Replacing existing install at $dest_app"
  # Use sudo only if we don't own /Applications (rare, but possible on
  # managed Macs). The common case is silently writable.
  if [ -w "/Applications" ]; then
    rm -rf "$dest_app"
  else
    sudo rm -rf "$dest_app"
  fi
fi

say "Installing to /Applications"
if [ -w "/Applications" ]; then
  cp -R "$src_app" /Applications/
else
  sudo cp -R "$src_app" /Applications/
fi

# Belt-and-suspenders: strip quarantine in case some part of the pipeline
# set it (e.g. a future curl behaviour change, or a user who manually ran
# the script via a quarantine-aware tool).
xattr -dr com.apple.quarantine "$dest_app" 2>/dev/null || true

say "Done"
note "Launch Fluister from Spotlight or /Applications/Fluister.app"
