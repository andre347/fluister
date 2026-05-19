import { useCallback, useState } from "react";
import type { Settings } from "../../lib/tauri";
import { Btn, Segmented, Tag } from "../../components/atoms";
import { Switch } from "../../components/ui/switch";
import { PrefGroup, PrefRow } from "./Pref";

/// The MCP server binds 127.0.0.1:43210. Two snippet forms because clients
/// differ in remote-MCP support:
///   - `url`     → Cursor / Claude Code / Zed / latest Claude Desktop.
///   - `command` → Stdio bridge (mcp-remote) for older Claude Desktop builds
///                 that silently skip url-based servers.
const MCP_URL = "http://localhost:43210/mcp";
const MCP_CONFIG_URL = JSON.stringify(
  { mcpServers: { fluister: { url: MCP_URL } } },
  null,
  2,
);
const MCP_CONFIG_BRIDGE = JSON.stringify(
  {
    mcpServers: {
      fluister: {
        command: "npx",
        args: ["-y", "mcp-remote", MCP_URL],
      },
    },
  },
  null,
  2,
);

type SnippetKind = "url" | "bridge";

const SNIPPET_OPTIONS: { value: SnippetKind; label: string }[] = [
  { value: "url", label: "Cursor / Code / Zed" },
  { value: "bridge", label: "Claude Desktop" },
];

type Props = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

export function IntegrationsPane({ settings, updateSettings }: Props) {
  const mcpOn = settings.mcp_enabled;

  return (
    <>
      <PrefGroup title="Model Context Protocol">
        <PrefRow
          label="Enable MCP server"
          hint="Lets Claude Desktop, Cursor, Claude Code, and Zed pull your dictation history, run cleanup on arbitrary text, and append notes into the vault. Bound to 127.0.0.1 only — never accessible over the network."
        >
          <div className="flex items-center gap-2.5">
            <Switch
              size="sm"
              checked={mcpOn}
              onCheckedChange={(v) => updateSettings({ mcp_enabled: v })}
            />
            {mcpOn ? (
              <Tag tone="green">Running</Tag>
            ) : (
              <Tag tone="neutral">Off</Tag>
            )}
          </div>
        </PrefRow>

        {mcpOn && (
          <PrefRow
            label="Endpoint"
            hint="Most clients let you paste a JSON snippet. Same shape works for Claude Desktop, Cursor, Claude Code, and Zed."
          >
            <ConfigSnippet />
          </PrefRow>
        )}

        <PrefRow
          label="What it exposes"
          hint="Five tools, all local: search_dictations, recent_dictations, get_dictation, clean_text, append_to_vault. Full reference in the docs."
        >
          <Btn
            size="sm"
            onClick={() =>
              import("@tauri-apps/api/core").then(({ invoke }) =>
                invoke<void>("open_external_url", {
                  url: "https://github.com/andre347/fluister/blob/main/docs/mcp.md",
                }).catch((err) => console.error(err)),
              )
            }
          >
            Open docs
          </Btn>
        </PrefRow>
      </PrefGroup>
    </>
  );
}

function ConfigSnippet() {
  const [kind, setKind] = useState<SnippetKind>("url");
  const [copied, setCopied] = useState(false);

  const snippet = kind === "url" ? MCP_CONFIG_URL : MCP_CONFIG_BRIDGE;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("clipboard write failed", err);
    }
  }, [snippet]);

  return (
    <div className="flex flex-col gap-2 max-w-[460px]">
      <Segmented
        options={SNIPPET_OPTIONS}
        value={kind}
        onChange={(v) => {
          setKind(v);
          setCopied(false);
        }}
        size="sm"
      />
      <pre className="bg-input-surface border-[0.5px] border-hair-strong rounded-[6px] px-3 py-2 font-fl-mono text-[11px] text-ink leading-[1.55] overflow-x-auto m-0 whitespace-pre">
        {snippet}
      </pre>
      <div className="flex items-center gap-2">
        <Btn size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy snippet"}
        </Btn>
        <span className="text-[11px] text-ink-3">
          {kind === "url"
            ? "For Cursor, Claude Code, Zed, and recent Claude Desktop."
            : "For Claude Desktop builds without native remote-MCP support. Requires Node.js installed."}
        </span>
      </div>
    </div>
  );
}
