# Releasing Fluister

Releases are tag-driven. Push `vX.Y.Z`, GitHub Actions does the rest.

## One-time setup

### 1. Generate the updater signing key

```bash
pnpm tauri signer generate -w ~/.tauri/fluister.key
```

Choose a passphrase. **Back up the key file somewhere safe** — losing it
means existing installs can never auto-update again (they'd have to
manually download a new DMG signed with a new key).

The command prints both halves. Copy the **public key** into
`src-tauri/tauri.conf.json` → `plugins.updater.pubkey`, replacing the
`REPLACE_WITH_PUBLIC_KEY_FROM_TAURI_SIGNER_GENERATE` placeholder. Commit
that change — public keys are safe to commit.

### 2. Add GitHub Actions secrets

In the `andre347/fluister` repo settings → Secrets and variables →
Actions, add two repository secrets:

| Name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `~/.tauri/fluister.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The passphrase you set in step 1 |

The default `GITHUB_TOKEN` covers the rest — no PAT needed.

## Cutting a release

```bash
pnpm bump 0.2.0                  # updates package.json + Cargo.toml + tauri.conf.json
git add -A && git commit -m "release: v0.2.0"
git tag v0.2.0
git push --follow-tags
```

The push triggers `.github/workflows/release.yml`. ~10 minutes later the
release appears at `github.com/andre347/fluister/releases/tag/v0.2.0`
with these assets:

- `Fluister_0.2.0_aarch64.dmg` — versioned, archival
- `Fluister_aarch64.dmg` — canonical name, used by the marketing site
- `Fluister.app.tar.gz` + `.sig` — used by the in-app updater
- `latest.json` — updater manifest

Existing installs will pick up the update next time they launch (or when
the user clicks **Check for updates…** in Settings → About).

## URLs that just work

These auto-resolve to whatever the newest release is — no redeploys
needed when shipping a new version:

- Marketing-site download button → `https://github.com/andre347/fluister/releases/latest/download/Fluister_aarch64.dmg`
- In-app updater endpoint → `https://github.com/andre347/fluister/releases/latest/download/latest.json`

## Caveat: notarization

The auto-updater works without an Apple Developer ID, but the *first*
install still triggers Gatekeeper's "unidentified developer" warning. To
remove that, sign up for the Apple Developer Program ($99/yr), then add
notarization secrets to CI:

```
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD            # app-specific password
APPLE_TEAM_ID
```

`tauri-action` picks these up automatically. The updater flow doesn't
change — once notarized, the warning goes away.

## Troubleshooting

- **Workflow fails on the `tauri-action` step** — usually a signing-key
  mismatch. Re-check `TAURI_SIGNING_PRIVATE_KEY` is the full file
  contents (including the `untrusted comment:` header), not just the
  key body.
- **Updater throws "Could not fetch a valid release"** — the endpoint
  URL or the public key in `tauri.conf.json` doesn't match what CI
  signed with. Verify both.
- **`bump.mjs` says "pattern not matched"** — one of the three files
  has drifted from the regex. Update the script or bump that file by
  hand.
