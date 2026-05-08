#!/usr/bin/env bash
# PostToolUse hook: runs `cargo clippy` after Claude edits a Rust file.
# Exits 2 with stderr containing the diagnostics so Claude sees them and fixes.
set -u

input=$(cat)

file_path=$(printf '%s' "$input" | /usr/bin/jq -r '.tool_input.file_path // empty' 2>/dev/null)
[[ -z "$file_path" || "$file_path" != *.rs ]] && exit 0

dir=$(dirname "$file_path")
while [[ "$dir" != "/" && ! -f "$dir/Cargo.toml" ]]; do
    dir=$(dirname "$dir")
done
[[ ! -f "$dir/Cargo.toml" ]] && exit 0

cd "$dir" || exit 0

output=$(cargo clippy --no-deps --quiet --message-format=short -- -D warnings 2>&1)
status=$?

if [[ $status -ne 0 ]]; then
    {
        echo "cargo clippy failed in $dir (triggered by $file_path):"
        echo "$output"
    } >&2
    exit 2
fi

exit 0
