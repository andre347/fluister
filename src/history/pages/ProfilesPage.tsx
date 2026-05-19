import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commands, type Profile } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import {
  Btn,
  Field,
  GroupLabel,
  Tag,
  Toolbar,
} from "../../components/atoms";
import { IconPlus, IconSparkle, IconX } from "../../components/icons";
import { profileDotColor } from "../../lib/profiles";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";
import { AppPickerDialog } from "../AppPickerDialog";
import { cn } from "../../lib/utils";

const NEW_KEY = "__new__";
type Selection = number | typeof NEW_KEY | null;

const DEFAULT_PREVIEW_RAW =
  "hey sam can we move the design review to thursday afternoon i want to make sure we have time to walk through the recording overlay variants together";

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([commands.listProfiles(), commands.getSettings()])
      .then(([profs, settings]) => {
        if (cancelled) return;
        setProfiles(profs);
        setActiveId(settings.active_profile_id);
        setSelection((curr) => {
          if (curr === NEW_KEY) return curr;
          if (typeof curr === "number" && profs.some((p) => p.id === curr))
            return curr;
          return profs[0]?.id ?? null;
        });
      })
      .catch((err) => console.error("profiles load failed", err));
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useTauriEvent<unknown>("profiles-changed", () => {
    setRefreshTick((n) => n + 1);
  });

  const handleSetActive = useCallback(async (id: number) => {
    try {
      await commands.setActiveProfile(id);
      setActiveId(id);
    } catch (err) {
      console.error("set_active_profile failed", err);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    try {
      await commands.deleteProfile(target.id);
      setSelection((curr) => (curr === target.id ? null : curr));
    } catch (err) {
      console.error("delete_profile failed", err);
    }
  }, [pendingDelete]);

  const selectedProfile = useMemo<Profile | null>(() => {
    if (selection === NEW_KEY) return null;
    if (typeof selection === "number") {
      return profiles.find((p) => p.id === selection) ?? null;
    }
    return null;
  }, [profiles, selection]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar
        section="Profiles"
        trailing={
          <Btn
            kind="plain"
            size="md"
            icon={<IconPlus size={13} strokeWidth={1.7} />}
            onClick={() => setSelection(NEW_KEY)}
          >
            New profile
          </Btn>
        }
      />

      <div className="flex-1 flex min-h-0">
        <ProfileList
          profiles={profiles}
          activeId={activeId}
          selection={selection}
          onSelect={setSelection}
          onNew={() => setSelection(NEW_KEY)}
        />

        {selection === null ? (
          <EmptyEditor message="Select a profile to edit, or create a new one." />
        ) : selection === NEW_KEY ? (
          <ProfileEditor
            key="new"
            isNew
            profile={null}
            isActive={false}
            onSetActive={() => {}}
            onDelete={() => {}}
            onSaved={(created) => {
              setRefreshTick((n) => n + 1);
              setSelection(created.id);
            }}
            onCancel={() => setSelection(profiles[0]?.id ?? null)}
          />
        ) : selectedProfile ? (
          <ProfileEditor
            key={selectedProfile.id}
            isNew={false}
            profile={selectedProfile}
            isActive={selectedProfile.id === activeId}
            onSetActive={() => handleSetActive(selectedProfile.id)}
            onDelete={() => setPendingDelete(selectedProfile)}
            onSaved={() => setRefreshTick((n) => n + 1)}
          />
        ) : (
          <EmptyEditor message="Profile not found." />
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete profile?"
        description={
          pendingDelete ? `“${pendingDelete.name}” will be removed.` : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function EmptyEditor({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-window-bg text-[13px] text-ink-3">
      {message}
    </div>
  );
}

interface ListProps {
  profiles: Profile[];
  activeId: number | null;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onNew: () => void;
}

function ProfileList({
  profiles,
  activeId,
  selection,
  onSelect,
  onNew,
}: ListProps) {
  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-y-auto border-r-[0.5px] border-hair backdrop-blur-2xl backdrop-saturate-[1.8]"
      style={{ width: 280, background: "var(--color-sidebar-bg)" }}
    >
      <GroupLabel>Profiles</GroupLabel>
      <div className="px-2 flex flex-col gap-px">
        {profiles.map((p) => (
          <ProfileRow
            key={p.id}
            profile={p}
            active={p.id === activeId}
            selected={selection === p.id}
            onClick={() => onSelect(p.id)}
          />
        ))}
        {selection === NEW_KEY && (
          <div className="flex items-center gap-2.5 px-2 py-[7px] rounded-[5px] bg-selection text-ink-2 italic text-[13px]">
            New profile…
          </div>
        )}
        <button
          type="button"
          onClick={onNew}
          className="mt-1 px-2 py-1.5 bg-transparent text-ink-3 font-sf text-[12px] text-left inline-flex items-center gap-1.5 cursor-pointer rounded-[5px] hover:bg-fl-hover"
        >
          <IconPlus size={12} color="var(--color-ink-3)" strokeWidth={1.7} />
          New profile
        </button>
      </div>
    </aside>
  );
}

interface RowProps {
  profile: Profile;
  active: boolean;
  selected: boolean;
  onClick: () => void;
}

function ProfileRow({ profile, active, selected, onClick }: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-2.5 px-2 py-[7px] rounded-[5px] text-left cursor-pointer",
        selected ? "bg-selection" : "hover:bg-fl-hover",
      )}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: profileDotColor(profile.name) }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] text-ink">
          <span className={cn("truncate", selected && "font-medium")}>
            {profile.name}
          </span>
          {active && <Tag tone="amber">Active</Tag>}
        </div>
        {profile.description && (
          <div className="text-[11px] text-ink-3 mt-px truncate">
            {profile.description}
          </div>
        )}
        {profile.app_bindings.length > 0 && (
          <div className="text-[10px] text-ink-3 font-fl-mono mt-[3px] tracking-[0.3px] truncate">
            {profile.app_bindings
              .map((b) => bundleIdToShortName(b))
              .join(" · ")}
          </div>
        )}
      </div>
    </button>
  );
}

function bundleIdToShortName(bundleId: string): string {
  // "com.apple.mail" → "Mail". Last segment, capitalized. Good-enough
  // display for the badge — the full name is in the chip itself.
  const last = bundleId.split(".").pop() ?? bundleId;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// ─── Editor ─────────────────────────────────────────────────────────────────

interface EditorProps {
  isNew: boolean;
  profile: Profile | null;
  isActive: boolean;
  onSetActive: () => void;
  onDelete: () => void;
  onSaved: (saved: Profile) => void;
  onCancel?: () => void;
}

function ProfileEditor({
  isNew,
  profile,
  isActive,
  onSetActive,
  onDelete,
  onSaved,
  onCancel,
}: EditorProps) {
  const baseline = profile ?? {
    name: "",
    description: "",
    style_prompt: "",
    vocabulary: "",
    app_bindings: [] as string[],
  };
  const [name, setName] = useState(baseline.name);
  const [description, setDescription] = useState(baseline.description);
  const [stylePrompt, setStylePrompt] = useState(baseline.style_prompt);
  const [vocabulary, setVocabulary] = useState(baseline.vocabulary);
  const [appBindings, setAppBindings] = useState<string[]>(
    baseline.app_bindings,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty =
    name !== baseline.name ||
    description !== baseline.description ||
    stylePrompt !== baseline.style_prompt ||
    vocabulary !== baseline.vocabulary ||
    appBindings.join(",") !== baseline.app_bindings.join(",");

  const canSave = name.trim().length > 0 && (isNew || dirty) && !saving;

  const handleSave = async () => {
    setSaveError(null);
    if (!canSave) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await commands.createProfile({
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
          app_bindings: appBindings,
        });
        onSaved(created);
      } else if (profile) {
        await commands.updateProfile({
          id: profile.id,
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
          app_bindings: appBindings,
        });
        onSaved({
          ...profile,
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
          app_bindings: appBindings,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("save profile failed", err);
      // Stays in the footer (red) so the user sees the actual reason
      // instead of guessing — UNIQUE constraint, network, etc.
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-window-bg scrollable">
      {/* Header */}
      <div className="px-7 pt-5 pb-4 border-b-[0.5px] border-hair">
        <div className="flex items-center gap-2.5">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: profileDotColor(name || baseline.name) }}
            aria-hidden
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isNew ? "New profile" : "Profile name"}
            autoFocus={isNew}
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[22px] font-semibold text-ink leading-none m-0 p-0"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
              letterSpacing: "-0.4px",
            }}
          />
          {isActive && <Tag tone="amber">Active</Tag>}
          <span className="flex-1" />
          {!isNew && profile && !isActive && (
            <Btn size="sm" onClick={onSetActive}>
              Make active
            </Btn>
          )}
          {!isNew && profile && (
            <Btn kind="danger" size="sm" onClick={onDelete}>
              Delete
            </Btn>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="px-7 pt-5 pb-4 flex flex-col gap-[18px]">
        <FormRow
          label="Description"
          hint="Shown in the recording overlay picker."
        >
          <Field
            value={description}
            onChange={setDescription}
            placeholder="e.g. Professional email body"
          />
        </FormRow>

        <FormRow
          label="Style instructions"
          hint="Sent to the local model after Whisper transcribes. Markdown supported."
        >
          <Field
            multiline
            rows={6}
            value={stylePrompt}
            onChange={setStylePrompt}
            placeholder="STYLE: Format the output as…"
          />
        </FormRow>

        <FormRow
          label="Apply when in"
          hint="Profile auto-activates when one of these apps is frontmost. Falls back to Default."
        >
          <div className="flex gap-1.5 flex-wrap">
            {appBindings.map((b) => (
              <AppChip
                key={b}
                bundleId={b}
                onRemove={() =>
                  setAppBindings((curr) => curr.filter((x) => x !== b))
                }
              />
            ))}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="border-[0.5px] border-dashed border-hair-strong bg-transparent text-ink-2 font-sf text-[12px] font-normal px-[9px] py-[3px] rounded-[5px] cursor-pointer inline-flex items-center gap-1 hover:bg-fl-hover"
            >
              <IconPlus
                size={11}
                color="var(--color-ink-2)"
                strokeWidth={1.7}
              />
              Add app
            </button>
          </div>
        </FormRow>

        <FormRow
          label="Vocabulary seeds"
          hint="Comma-separated terms biased into Whisper's transcription. Stacks with the global Vocabulary tab."
        >
          <Field
            multiline
            rows={3}
            value={vocabulary}
            onChange={setVocabulary}
            placeholder="TypeScript, Tauri, Whisper"
          />
        </FormRow>
      </div>

      {/* Live preview */}
      <div className="px-7 pt-5 pb-7 border-t-[0.5px] border-hair">
        <GroupLabel className="px-0 pt-0 pb-2">Live preview</GroupLabel>
        <LivePreview stylePrompt={stylePrompt} />
      </div>

      {/* Footer */}
      <div className="mt-auto sticky bottom-0 px-7 py-2.5 border-t-[0.5px] border-hair flex items-center gap-2 bg-window-bg/85 backdrop-blur-xl">
        {/* Status text only speaks when there's something to say. The
            "no changes" idle state stays silent — Save being disabled is
            already the visual cue. */}
        {(saveError || !name.trim() || saving || dirty) && (
          <span
            className={`text-[11px] font-fl-mono ${saveError ? "text-red" : "text-ink-3"}`}
            title={saveError ?? undefined}
          >
            {saveError
              ? `Error: ${saveError}`
              : !name.trim()
                ? "Name required"
                : saving
                  ? "Saving…"
                  : "unsaved changes"}
          </span>
        )}
        <span className="flex-1" />
        {onCancel && (
          <Btn size="sm" onClick={onCancel}>
            Cancel
          </Btn>
        )}
        <Btn
          kind="primary"
          size="sm"
          disabled={!canSave}
          onClick={handleSave}
        >
          {isNew ? "Create profile" : saving ? "Saving…" : "Save"}
        </Btn>
      </div>

      <AppPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeBundleIds={appBindings}
        onPick={(app) =>
          setAppBindings((curr) => [...curr, app.bundle_id])
        }
      />
    </div>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid items-start gap-6"
      style={{ gridTemplateColumns: "180px 1fr" }}
    >
      <div className="pt-1">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {hint && (
          <div className="text-[11px] text-ink-3 mt-0.5 leading-[1.5]">
            {hint}
          </div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AppChip({
  bundleId,
  onRemove,
}: {
  bundleId: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2 pr-2 py-[3px] bg-input-surface border-[0.5px] border-hair-strong rounded-[5px] text-[12px] text-ink">
      <span className="font-fl-mono text-[10.5px] text-ink-2">{bundleId}</span>
      <button
        type="button"
        onClick={onRemove}
        className="bg-transparent border-0 p-0 cursor-pointer inline-flex text-ink-3 ml-px hover:text-ink"
        aria-label={`Remove ${bundleId}`}
      >
        <IconX size={10} strokeWidth={1.8} />
      </button>
    </span>
  );
}

// ─── Live preview ───────────────────────────────────────────────────────────

interface LivePreviewProps {
  stylePrompt: string;
}

function LivePreview({ stylePrompt }: LivePreviewProps) {
  const [raw, setRaw] = useState(DEFAULT_PREVIEW_RAW);
  const [cleaned, setCleaned] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const myReq = ++reqIdRef.current;
      setPending(true);
      setError(null);
      commands
        .cleanupPreview(raw, stylePrompt)
        .then((out) => {
          if (myReq !== reqIdRef.current) return;
          setCleaned(out);
        })
        .catch((err) => {
          if (myReq !== reqIdRef.current) return;
          setError(String(err));
        })
        .finally(() => {
          if (myReq !== reqIdRef.current) return;
          setPending(false);
        });
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [raw, stylePrompt]);

  return (
    <div
      className="grid items-stretch"
      style={{ gridTemplateColumns: "1fr 24px 1fr" }}
    >
      <div className="p-3.5 rounded-card bg-fill font-fl-mono text-[12px] text-ink-2 leading-[1.55]">
        <div className="font-sf text-[10px] text-ink-3 font-semibold tracking-[0.4px] uppercase mb-2">
          Sample raw
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          className="w-full bg-transparent border-0 outline-none resize-none font-fl-mono text-[12px] text-ink-2 leading-[1.55]"
        />
      </div>
      <div className="flex items-center justify-center text-amber-ink">→</div>
      <div className="p-3.5 rounded-card bg-input-surface border-[0.5px] border-hair min-h-[120px]">
        <div className="flex items-center gap-1.5 mb-2 font-sf text-[10px] text-amber-ink font-semibold tracking-[0.4px] uppercase">
          <IconSparkle size={10} color="var(--color-amber-ink)" />
          <span>{pending ? "Cleaning…" : error ? "Error" : "Cleaned"}</span>
        </div>
        {error ? (
          <p className="m-0 text-red text-[12px]">{error}</p>
        ) : cleaned ? (
          <p
            className="m-0 text-[13.5px] text-ink whitespace-pre-wrap"
            style={{ lineHeight: 1.55 }}
          >
            {cleaned}
          </p>
        ) : (
          <p className="m-0 text-ink-3 italic text-[13px]">
            {pending ? "" : "Type or wait for cleanup…"}
          </p>
        )}
      </div>
    </div>
  );
}
