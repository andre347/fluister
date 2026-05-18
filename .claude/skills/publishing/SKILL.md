---
name: publishing
description: Cut a new Fluister release. Bumps version, tags, pushes, waits for CI, verifies the resulting GitHub release.
argument-hint: <new-version, e.g. 0.2.0>
user-invocable: true
allowed-tools: Read, Bash, Edit
---

# Publishing a Fluister release

Releases are tag-driven. Pushing a `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which builds the Apple-Silicon bundle, signs it with the updater key, and uploads the canonical-named assets to a GitHub release. Existing installs pick up the update on next launch.

## Input

Target version: `$ARGUMENTS`

If empty, ask the user. Validate semver shape (`X.Y.Z`).

## Preflight

Run in order. Stop if any check fails.

1. Working tree clean: `git status` shows no changes.
2. On `main`: `git rev-parse --abbrev-ref HEAD` is `main`.
3. Up to date with origin: `git fetch && git status` shows "up to date".
4. Current version is older than target: read from `package.json` `version` field, compare semver.
5. Tag doesn't already exist: `git tag -l vX.Y.Z` empty, and `git ls-remote --tags origin vX.Y.Z` empty.

## Build sanity (optional but recommended)

If you can spare 2 minutes locally:

```sh
pnpm install --frozen-lockfile
pnpm run build
```

Catches anything `tsc` would flag. The Rust side is exercised by CI; you don't need to build it locally unless you're paranoid.

## Bump, commit, tag, push

```sh
pnpm bump X.Y.Z
git add -A
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push --follow-tags
```

`pnpm bump` touches three files: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`. The script prints which files it updated; if any say "pattern not matched", inspect manually.

Use `git tag -a` (annotated). Lightweight tags from `git tag X` are not carried by `--follow-tags` and the CI workflow won't fire. If you forget, push the tag explicitly: `git push origin vX.Y.Z`.

## What CI does

About 8–12 minutes total on `macos-14`:

1. Checks out the tag.
2. Installs pnpm + Node + the `aarch64-apple-darwin` Rust target.
3. Runs `pnpm tauri build --target aarch64-apple-darwin`. The `build.rs` fetches the bundled `llama-server` binary into `src-tauri/binaries/` during the cargo compile step.
4. `tauri-action` signs the `.app.tar.gz` with the updater key from secrets, creates the GitHub release, uploads `Fluister_X.Y.Z_aarch64.dmg`, `Fluister.app.tar.gz`, `Fluister.app.tar.gz.sig`, and `latest.json`.
5. A follow-up step downloads the versioned DMG and re-uploads it as `Fluister_aarch64.dmg` so the marketing-site download URL keeps working.

Watch the run at `github.com/andre347/fluister/actions`.

## Verification

After the workflow goes green:

1. Release exists at `github.com/andre347/fluister/releases/tag/vX.Y.Z` with the five assets plus the auto-generated source archives.
2. Marketing-site URL resolves: `curl -sLI https://github.com/andre347/fluister/releases/latest/download/Fluister_aarch64.dmg | head -1` returns 200 (after 302s).
3. Updater endpoint serves the new version: `curl -sL https://github.com/andre347/fluister/releases/latest/download/latest.json | jq .version` returns `"X.Y.Z"`.
4. Edit the release notes on GitHub to something user-facing if the commit message body isn't suitable. `tauri-action` pastes the head commit message into the release body by default, which reads awkwardly for `release: vX.Y.Z` messages.

## Gotchas

These have bitten us before. Watch for them.

### `--follow-tags` skips lightweight tags

`git tag X` creates a lightweight tag. `git push --follow-tags` only pushes annotated tags. Use `git tag -a X -m "X"` or push the tag explicitly.

### `hardenedRuntime` without notarization

In `src-tauri/tauri.conf.json` under `bundle.macOS`, `hardenedRuntime` must be `false` until the app is notarized with a real Apple Developer ID. With `hardenedRuntime: true` and no proper signature, macOS reports the DMG as "damaged and can't be opened" instead of the friendlier "unidentified developer" Gatekeeper dialog. Users panic. When you eventually set up notarization, flip it back to `true` as part of that change.

### Updater public-key paste artifacts

The public key lives in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. If you ever regenerate it, copy carefully. zsh appends a `%` to the last line of terminal output when there's no trailing newline; that `%` will end up at the end of the pasted key and break base64 decoding silently. Strip it.

### Private signing key

`~/.tauri/fluister.key` (or wherever you stored it). Never commit it. Never paste it into chat. Losing it means existing installs can never auto-update again because they verify signatures against the public key baked into the app, and you can't produce matching signatures without the private half. Back it up offline.

The CI workflow reads it from the `TAURI_SIGNING_PRIVATE_KEY` secret. If you ever rotate the secret, paste the *full* file contents including the `untrusted comment:` header line, not just the key body.

### `beforeBundleCommand`

We do not have one. Don't add one for `fetch-llama-server.sh`. The script is already invoked by `src-tauri/build.rs` during the cargo compile step using an absolute `CARGO_MANIFEST_DIR` path. A `beforeBundleCommand` with a relative path resolves from the repo root (where the script doesn't live) and fails CI at exit 127. The local build works regardless because `build.rs` already populated the binary, masking the bug.

### Asset names must stay canonical

The marketing site button at `releases/latest/download/Fluister_aarch64.dmg` only works if every release uploads an asset with *exactly* that filename. The workflow handles this by copying the versioned DMG to the canonical name. If you change the workflow, preserve the rename step.

### Apple Silicon only

CI builds `aarch64-apple-darwin` only. Intel Macs cannot run Fluister (whisper-rs Metal feature, llama-server arm64 binary). The marketing site should make this clear.

### Tag rewriting is sometimes fine

If CI fails before producing a release, the tag is harmless to delete and recreate:

```sh
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

But never do this once a release has been published with shippable artifacts. Existing users would still have the old build, and the version number would now point at something they don't have.

## Hotfix flow

If a shipped release has a bug:

1. Don't rewrite the tag.
2. Cut the next patch version following the normal flow above.
3. Bumping the patch is fine even for one-line fixes; users get the new build via the updater.

## Failure modes to expect

| Symptom | Likely cause |
|---|---|
| Workflow doesn't fire on tag push | Lightweight tag instead of annotated. Re-tag with `-a`. |
| `tauri-action` fails on signing step | Secret `TAURI_SIGNING_PRIVATE_KEY` is truncated. Re-paste with the comment header. |
| Bundle step fails at `beforeBundleCommand` exit 127 | Someone re-added a relative-path `beforeBundleCommand`. Remove it. |
| Bundle succeeds, release page empty | `GITHUB_TOKEN` lacks write permission. Repo Settings → Actions → General → Workflow permissions → "Read and write". |
| Updater endpoint 404 | `latest.json` didn't upload. Check the workflow log; usually a `tauri-action` config issue. |
| Marketing-site URL 404 | Canonical-rename step skipped. Check the workflow log for the `gh release upload` line. |

## Reference

Full release setup (one-time keygen, secrets, etc.) lives in `RELEASING.md` at the repo root. This skill assumes the one-time setup is already done.
