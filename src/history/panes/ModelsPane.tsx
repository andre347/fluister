import type {
  DownloadProgress,
  ModelInfo,
} from "../../lib/tauri";
import { Btn } from "../../components/atoms";
import { PrefGroup, PrefRow } from "./Pref";
import { formatBytes } from "../../lib/format";

type Props = {
  whisperModels: ModelInfo[];
  downloads: Map<string, DownloadProgress>;
  onSwitchModel: (path: string) => void;
  onDownloadModel: (filename: string) => void;
};

export function ModelsPane({
  whisperModels,
  downloads,
  onSwitchModel,
  onDownloadModel,
}: Props) {
  return (
    <>
      <p className="text-[12px] text-ink-2 leading-[1.55] mb-3 ml-[184px] max-w-[420px]">
        These are the speech-to-text models — they turn what you say into raw
        text, all on your Mac. Smaller models are faster and use less memory;
        larger ones are slower but transcribe more accurately, especially with
        accents, names, or technical words.
      </p>

      <PrefGroup title="Available models">
        {whisperModels.map((m) => (
          <WhisperRow
            key={m.filename}
            model={m}
            download={downloads.get(m.filename)}
            onUse={onSwitchModel}
            onDownload={onDownloadModel}
          />
        ))}
      </PrefGroup>
    </>
  );
}

function WhisperRow({
  model,
  download,
  onUse,
  onDownload,
}: {
  model: ModelInfo;
  download: DownloadProgress | undefined;
  onUse: (path: string) => void;
  onDownload: (filename: string) => void;
}) {
  let action: React.ReactNode;
  let meta: string;

  if (download) {
    const pct =
      download.total > 0
        ? Math.min(100, Math.floor((download.downloaded / download.total) * 100))
        : 0;
    action = (
      <div className="flex items-center gap-2 min-w-[140px]">
        <div className="h-1 flex-1 rounded bg-fill overflow-hidden">
          <div
            className="h-full bg-amber transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] text-ink-3 tabular-nums w-8 text-right">
          {pct}%
        </span>
      </div>
    );
    const downloaded = formatBytes(download.downloaded);
    const total = formatBytes(download.total);
    const speed =
      download.bytes_per_sec > 0
        ? ` · ${formatBytes(download.bytes_per_sec)}/s`
        : "";
    meta = `${downloaded} / ${total}${speed}`;
  } else if (model.active) {
    action = (
      <Btn size="sm" disabled>
        Active
      </Btn>
    );
    meta = `${formatBytes(model.size_bytes)} · Installed · ${model.multilingual ? "99 languages" : "English only"}`;
  } else if (model.installed) {
    action = (
      <Btn size="sm" onClick={() => onUse(model.path)}>
        Use
      </Btn>
    );
    meta = `${formatBytes(model.size_bytes)} · Installed · ${model.multilingual ? "99 languages" : "English only"}`;
  } else {
    action = (
      <Btn size="sm" onClick={() => onDownload(model.filename)}>
        Download · {formatBytes(model.size_bytes)}
      </Btn>
    );
    meta = `${formatBytes(model.size_bytes)} · Not installed · ${model.multilingual ? "99 languages" : "English only"}`;
  }

  return (
    <PrefRow label={model.label} hint={meta}>
      {action}
    </PrefRow>
  );
}
