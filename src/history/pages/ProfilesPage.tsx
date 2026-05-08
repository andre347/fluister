import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commands, type Profile } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";
import { EditorHeader } from "../EditorHeader";
import { EmptyDetail } from "../EmptyDetail";
import { NewItemToolbar } from "../NewItemToolbar";
import { cn } from "../../lib/utils";

const NEW_KEY = "__new__";
type Selection = number | typeof NEW_KEY | null;

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);

  // Load profiles + active profile id whenever changed.
  useEffect(() => {
    let cancelled = false;
    Promise.all([commands.listProfiles(), commands.getSettings()])
      .then(([profs, settings]) => {
        if (cancelled) return;
        setProfiles(profs);
        setActiveId(settings.active_profile_id);
        // Default selection: keep current if still present, else first profile.
        setSelection((curr) => {
          if (curr === NEW_KEY) return curr;
          if (typeof curr === "number" && profs.some((p) => p.id === curr)) return curr;
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
    <div className="hist-twocol">
      <div className="hist-list-pane">
        <NewItemToolbar
          label="New profile"
          selected={selection === NEW_KEY}
          onSelect={() => setSelection(NEW_KEY)}
        />
        <div className="hist-list-scroll scrollable">
          {profiles.length === 0 && selection !== NEW_KEY ? (
            <div className="hist-list-empty">No profiles yet</div>
          ) : (
            profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelection(p.id)}
                aria-pressed={selection === p.id}
                className={cn(
                  "hist-list-row hist-list-row-tall",
                  selection === p.id && "hist-list-row-selected",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-item font-medium truncate">
                    {p.name}
                  </span>
                  {p.id === activeId && (
                    <span className="text-tag font-medium uppercase tracking-wider text-[color:var(--color-brand)] shrink-0">
                      Active
                    </span>
                  )}
                </div>
                {p.description && (
                  <div className="hist-list-row-text">{p.description}</div>
                )}
              </button>
            ))
          )}
          {selection === NEW_KEY && (
            <div className="hist-list-row hist-list-row-selected hist-list-row-tall">
              <div className="text-item font-medium italic text-text-muted">
                New profile…
              </div>
            </div>
          )}
        </div>
      </div>

      {selection === null ? (
        <EmptyDetail label="Select a profile to edit, or create a new one." />
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
        <EmptyDetail label="Profile not found." />
      )}

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

function ProfileEditor({
  isNew,
  profile,
  isActive,
  onSetActive,
  onDelete,
  onSaved,
  onCancel,
}: {
  isNew: boolean;
  profile: Profile | null;
  isActive: boolean;
  onSetActive: () => void;
  onDelete: () => void;
  onSaved: (saved: Profile) => void;
  onCancel?: () => void;
}) {
  const baseline = profile ?? {
    name: "",
    description: "",
    style_prompt: "",
    vocabulary: "",
  };
  const [name, setName] = useState(baseline.name);
  const [description, setDescription] = useState(baseline.description);
  const [stylePrompt, setStylePrompt] = useState(baseline.style_prompt);
  const [vocabulary, setVocabulary] = useState(baseline.vocabulary);
  const [saving, setSaving] = useState(false);
  const baselineRef = useRef(baseline);
  useEffect(() => {
    baselineRef.current = baseline;
  });

  const dirty =
    name !== baseline.name ||
    description !== baseline.description ||
    stylePrompt !== baseline.style_prompt ||
    vocabulary !== baseline.vocabulary;

  const canSave = name.trim().length > 0 && (isNew || dirty) && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await commands.createProfile({
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
        });
        onSaved(created);
      } else if (profile) {
        await commands.updateProfile({
          id: profile.id,
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
        });
        onSaved({ ...profile, name: name.trim(), description: description.trim(), style_prompt: stylePrompt, vocabulary });
      }
    } catch (err) {
      console.error("save profile failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hist-detail">
      <EditorHeader
        title={isNew ? "New profile" : "Edit profile"}
        dirty={dirty}
        isNew={isNew}
        canDelete={!isNew && !!profile}
        saving={saving}
        canSave={canSave}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={handleSave}
      >
        {!isNew && profile && !isActive && (
          <Button variant="ghost" size="sm" onClick={onSetActive} className="h-8">
            Make active
          </Button>
        )}
      </EditorHeader>

      <div className="hist-detail-scroll">
        <div className="flex flex-col gap-5 max-w-[640px]">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quick reply"
              autoFocus={isNew}
            />
          </Field>

          <Field
            label="Description"
            hint="Short label so you remember what this profile does."
          >
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field
            label="Style prompt"
            hint="Appended to the cleanup instructions. Tells Ollama how to format the output for this profile."
          >
            <Textarea
              rows={6}
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="STYLE: Format the output as…"
            />
          </Field>

          <Field
            label="Vocabulary seeds"
            hint="Comma-separated terms biased into Whisper's transcription. Stacks with the global Vocabulary tab."
          >
            <Textarea
              rows={4}
              value={vocabulary}
              onChange={(e) => setVocabulary(e.target.value)}
              placeholder="TypeScript, Tauri, Whisper"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-body font-medium text-foreground">{label}</div>
        {hint && (
          <div className="text-footnote text-muted-foreground leading-snug mt-1">
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
