#!/usr/bin/env bash
# Stages the llama.cpp `llama-server` binary plus its dylibs and Metal shader
# into the Tauri bundle inputs. Idempotent — re-running with the pinned
# version is a no-op.
#
# Layout produced:
#   src-tauri/binaries/llama-server-aarch64-apple-darwin   (Tauri externalBin)
#   src-tauri/resources/llama/libllama.dylib
#   src-tauri/resources/llama/libggml*.dylib
#   src-tauri/resources/llama/default.metallib (or ggml-metal.metal fallback)
#
# The binary's `LC_RPATH` is rewritten with `install_name_tool` to
# `@executable_path/../Resources/llama` so it finds the dylibs both in the
# bundled .app *and* in `target/.../` during `cargo run`/`tauri dev` (where the
# same Resources tree is shipped alongside the staged binary via build.rs).

set -euo pipefail

LLAMA_VERSION="${LLAMA_VERSION:-b6543}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_TAURI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$SRC_TAURI_DIR/binaries"
RES_DIR="$SRC_TAURI_DIR/resources/llama"
STAGE_DIR="$SRC_TAURI_DIR/.llama-stage"
STAMP_FILE="$STAGE_DIR/version.txt"

mkdir -p "$BIN_DIR" "$RES_DIR" "$STAGE_DIR"

# Idempotency: skip if pinned version already staged.
if [[ -f "$STAMP_FILE" ]] && [[ "$(cat "$STAMP_FILE")" == "$LLAMA_VERSION" ]] \
    && [[ -x "$BIN_DIR/llama-server-aarch64-apple-darwin" ]] \
    && [[ -f "$RES_DIR/libllama.dylib" ]]; then
    echo "fetch-llama-server: $LLAMA_VERSION already staged"
    exit 0
fi

# Only arm64 is supported (Apple Silicon only, matches whisper-rs/metal build).
ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" ]]; then
    echo "fetch-llama-server: ERROR — unsupported arch '$ARCH' (need arm64)" >&2
    exit 1
fi

ASSET="llama-${LLAMA_VERSION}-bin-macos-arm64.zip"
URL="https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_VERSION}/${ASSET}"
ZIP_PATH="$STAGE_DIR/$ASSET"
EXTRACT_DIR="$STAGE_DIR/extracted"

if [[ ! -f "$ZIP_PATH" ]]; then
    echo "fetch-llama-server: downloading $URL"
    curl -fSL --retry 3 -o "$ZIP_PATH.partial" "$URL"
    mv "$ZIP_PATH.partial" "$ZIP_PATH"
fi

rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"

# The release zip layout has shifted between llama.cpp versions: sometimes
# `bin/llama-server`, sometimes `build/bin/llama-server`. Find them rather
# than hard-coding a path.
SRC_BIN="$(find "$EXTRACT_DIR" -type f -name 'llama-server' | head -n1)"
if [[ -z "$SRC_BIN" ]]; then
    echo "fetch-llama-server: ERROR — no llama-server binary in $ASSET" >&2
    exit 1
fi
SRC_BIN_DIR="$(dirname "$SRC_BIN")"

# Copy binary to the Tauri externalBin path. The triple suffix is required —
# Tauri strips it at runtime and dev/bundle both look for this exact name.
cp -f "$SRC_BIN" "$BIN_DIR/llama-server-aarch64-apple-darwin"
chmod +x "$BIN_DIR/llama-server-aarch64-apple-darwin"

# Copy every dylib next to the source binary (some llama.cpp builds keep
# them in ../lib, some in the same dir as the binary).
shopt -s nullglob
DYLIB_CANDIDATES=("$SRC_BIN_DIR"/*.dylib "$SRC_BIN_DIR"/../lib/*.dylib)
for src in "${DYLIB_CANDIDATES[@]}"; do
    [[ -f "$src" ]] || continue
    cp -f "$src" "$RES_DIR/$(basename "$src")"
done

# Metal shader. Newer builds ship a precompiled `default.metallib`; older
# builds ship `ggml-metal.metal` source. Take whichever exists.
for shader in "$SRC_BIN_DIR"/default.metallib \
              "$SRC_BIN_DIR"/../lib/default.metallib \
              "$SRC_BIN_DIR"/ggml-metal.metal \
              "$SRC_BIN_DIR"/../share/ggml-metal.metal; do
    if [[ -f "$shader" ]]; then
        cp -f "$shader" "$RES_DIR/$(basename "$shader")"
    fi
done

# Sanity check: we need at least libllama and libggml on disk now.
if [[ ! -f "$RES_DIR/libllama.dylib" ]] || ! ls "$RES_DIR"/libggml*.dylib >/dev/null 2>&1; then
    echo "fetch-llama-server: ERROR — expected dylibs missing from $RES_DIR" >&2
    exit 1
fi

# Rewrite rpath so the binary finds the dylibs from `Contents/Resources/llama`
# inside the .app. The same layout is used in dev (see build.rs which copies
# the resources tree into target/.../Resources/llama).
#
# Strip any pre-existing rpaths first — upstream builds sometimes carry a
# Linux-style `@loader_path/../lib` that doesn't apply on macOS.
EXISTING_RPATHS="$(otool -l "$BIN_DIR/llama-server-aarch64-apple-darwin" \
    | awk '/LC_RPATH/{flag=1;next} flag && /path /{print $2; flag=0}')" || true
while IFS= read -r rp; do
    [[ -z "$rp" ]] && continue
    install_name_tool -delete_rpath "$rp" "$BIN_DIR/llama-server-aarch64-apple-darwin" 2>/dev/null || true
done <<< "$EXISTING_RPATHS"

# Two rpaths so dyld resolves both the bundled-app layout and the dev layout:
#   bundled: Fluister.app/Contents/MacOS/llama-server-...  → ../Resources/llama
#   dev:     src-tauri/binaries/llama-server-...           → ../resources/llama
# dyld walks LC_RPATH entries in order; whichever exists first wins.
install_name_tool -add_rpath "@executable_path/../Resources/llama" \
    "$BIN_DIR/llama-server-aarch64-apple-darwin"
install_name_tool -add_rpath "@executable_path/../resources/llama" \
    "$BIN_DIR/llama-server-aarch64-apple-darwin"

echo "$LLAMA_VERSION" > "$STAMP_FILE"
echo "fetch-llama-server: staged $LLAMA_VERSION"
