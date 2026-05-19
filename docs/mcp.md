# MCP server

Fluister ships a [Model Context Protocol](https://modelcontextprotocol.io) server so AI clients can read your dictation history, run cleanup on arbitrary text, and append notes into your vault.

It is **off by default**, **localhost only**, and **fully local** — no cloud calls.

## Enable it

Settings → Integrations → toggle **Enable MCP server**.

When the toggle is on, Fluister binds `127.0.0.1:43210` and serves the [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) transport at `/mcp`. The endpoint never accepts connections from any other host.

## Wire it into your AI client

Two config forms exist. Pick the one your client supports.

### Form A — Bare URL (recommended where supported)

Works in **Cursor**, **Claude Code**, **Zed**, and recent **Claude Desktop** builds with Streamable HTTP support.

```json
{
  "mcpServers": {
    "fluister": {
      "url": "http://localhost:43210/mcp"
    }
  }
}
```

### Form B — Stdio bridge (Claude Desktop)

If Claude Desktop silently skips Fluister with a message like *"`fluister` is not supported"*, your build doesn't have native remote-MCP support yet. Use the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge — it runs as a stdio server in front of Claude Desktop and proxies to the local URL. Requires Node.js installed (the standard `node` + `npx` from [nodejs.org](https://nodejs.org) or `brew install node`).

```json
{
  "mcpServers": {
    "fluister": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:43210/mcp"]
    }
  }
}
```

`npx` fetches the bridge once on first launch and caches it. Subsequent launches reuse the cached binary.

### Config file paths

| Client          | Config path |
|-----------------|-------------|
| Claude Desktop  | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor          | `~/.cursor/mcp.json` (or the in-app **Settings → MCP** UI) |
| Claude Code     | `~/.claude.json` (or `claude mcp add fluister http://localhost:43210/mcp`) |
| Zed             | `~/.config/zed/settings.json` under `context_servers` |

Restart the client after editing. The Fluister tools should appear in the tool picker.

### Sanity-check the server is up

Before debugging the client side, confirm Fluister itself is listening:

```sh
curl -sS -X POST http://localhost:43210/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,
       "params":{"protocolVersion":"2024-11-05","capabilities":{},
                 "clientInfo":{"name":"curl","version":"0"}}}'
```

You should get a JSON or SSE response containing Fluister's `serverInfo` and capabilities. Connection refused means the toggle in Settings → Integrations isn't on.

## Tools

All nine tools are local. Inputs are JSON; outputs are JSON-encoded text content.

### `search_dictations`

Substring search across both the cleaned and raw transcript. Results are ordered newest-first.

| Field   | Type   | Default | Notes                                |
|---------|--------|---------|--------------------------------------|
| `query` | string | —       | Required. Case-insensitive contains. |
| `limit` | int    | 20      | Clamped to [1, 200].                 |

Returns: array of dictation summaries (`id`, `created_at_ms`, `cleaned_text`, `raw_text`, `duration_ms`, `favorite`, `profile_id`).

### `recent_dictations`

Most-recent N dictations regardless of content.

| Field   | Type | Default | Notes                |
|---------|------|---------|----------------------|
| `limit` | int  | 10      | Clamped to [1, 200]. |

Returns: same shape as `search_dictations`.

### `get_dictation`

Fetch a single dictation by its numeric id.

| Field | Type | Notes                                  |
|-------|------|----------------------------------------|
| `id`  | int  | Required. ID from search/recent.       |

Returns: one dictation summary, or an `invalid_params` error if no such id.

### `clean_text`

Pass arbitrary text through Fluister's cleanup pipeline (currently the bundled `llama-server` sidecar by default, or external Ollama if configured).

| Field        | Type   | Default | Notes                                                                                                 |
|--------------|--------|---------|-------------------------------------------------------------------------------------------------------|
| `text`       | string | —       | Required.                                                                                             |
| `profile_id` | int    | none    | Optional. If set, that profile's `style_prompt` is appended to the cleanup instructions.              |

Returns: the cleaned string as plain text.

### `append_to_vault`

Append content to a file inside the user's Fluister vault. Parent directories are created if missing. Absolute paths and `..` segments are rejected.

| Field     | Type   | Notes                                                                          |
|-----------|--------|--------------------------------------------------------------------------------|
| `path`    | string | Required. Relative to the vault root. Example: `inbox/today.md`.               |
| `content` | string | Required. Appended verbatim; a trailing newline is added if not present.       |

Returns: absolute path written to.

If the user has not set up a vault, this tool returns `invalid_request` with a hint to configure one in Settings → Storage.

### `read_vault`

Read a file from inside the user's Fluister vault. Same path safety rules as `append_to_vault`. Pairs with `append_to_vault` so AI clients can read-modify-write notes round-trip.

| Field   | Type   | Notes                                                                          |
|---------|--------|--------------------------------------------------------------------------------|
| `path`  | string | Required. Relative to the vault root. Example: `inbox/today.md`.               |

Returns: the file contents as a UTF-8 string. Fails loudly on non-UTF8 files.

### `list_profiles`

List the user's cleanup profiles. Use the returned `id` with `clean_text` to apply that profile's tone.

No parameters.

Returns: array of `{ id, name, description, style_prompt, app_bindings }`.

### `list_vocabulary`

List the user's vocabulary entries (canonical terms + phonetic aliases Whisper sometimes hears in their place).

No parameters.

Returns: array of `{ id, term, aliases }`.

### `add_vocabulary`

Create a new vocabulary entry. Writes through to the vault when one is configured. Common use: after analysing dictations and spotting a recurring mishearing.

| Field     | Type     | Notes                                                                    |
|-----------|----------|--------------------------------------------------------------------------|
| `term`    | string   | Required. Canonical spelling.                                            |
| `aliases` | string[] | Optional. Phonetic variants. Empty list is fine for plain bias terms.    |

Returns: the new entry `{ id, term, aliases }`.

## Security

- Binds only to `127.0.0.1`. The OS network stack rejects connections from other hosts.
- No auth token. The threat model is "other processes on the same machine," which is the same boundary as the local SQLite database and the vault on disk.
- The toggle is **off by default**. Turning it on is an explicit, single-click opt-in.
- Disabling the toggle stops the server cleanly within a few seconds. The port is freed.
- On app quit, Fluister awaits an in-flight shutdown so no orphan listener is left behind.

## Troubleshooting

**Tools don't appear in the client.**
The client probably can't reach `http://localhost:43210/mcp`. Verify the toggle is on in Settings → Integrations and that nothing else is bound to port 43210:

```sh
lsof -i :43210
```

If something else owns the port, kill it or change Fluister's port (currently fixed — open an issue if you need this configurable).

**`clean_text` returns "Cleanup model is not downloaded yet."**
The bundled `llama-server` needs a model file. Settings → Cleanup → download the bundled cleanup model.

**`append_to_vault` returns "no vault configured."**
Settings → Storage → set up a vault folder. Re-run the tool.

**Search returns nothing for terms you remember dictating.**
The tool only matches the dictation text (cleaned + raw). Search is substring, case-insensitive. Tags, profiles, dates aren't searchable yet — open an issue if useful.

## Architecture notes

- Transport: rmcp's `StreamableHttpService`, nested at `/mcp` on a tiny axum router. Other paths return 404 — keeps MCP clients' OAuth discovery probes (e.g. `/.well-known/oauth-authorization-server`) from being misrouted into the streamable-HTTP Accept-header check and bouncing back with a confusing 406.
- Service is `Clone`-friendly and stateless except for an `AppHandle` it uses to reach the database and settings.
- Tool dispatch is `#[tool]` macros from rmcp; input schemas are auto-derived via `schemars`.
- The bundled `llama-server` is reused — `clean_text` is the same code path as the in-app cleanup pipeline.
- Lifecycle: lives in `src-tauri/src/mcp.rs`. Started from `setup()` if `Settings.mcp_enabled`, reconciled on toggle changes via `sync_mcp_to_settings`, drained on `RunEvent::Exit`.
