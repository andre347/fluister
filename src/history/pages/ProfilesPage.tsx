import { useCallback, useEffect, useState } from "react";
import { commands, type Profile } from "../../lib/tauri";
import { useTauriEvent } from "../../lib/hooks";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { PageLayout } from "./HistoryPage";

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Load profiles + active profile id whenever changed.
  useEffect(() => {
    let cancelled = false;
    Promise.all([commands.listProfiles(), commands.getSettings()])
      .then(([profs, settings]) => {
        if (cancelled) return;
        setProfiles(profs);
        setActiveId(settings.active_profile_id);
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
    } catch (err) {
      console.error("set_active_profile failed", err);
    }
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("Delete this profile?")) return;
    try {
      await commands.deleteProfile(id);
    } catch (err) {
      console.error("delete_profile failed", err);
    }
  }, []);

  const editing =
    editingId === "new"
      ? { id: 0, name: "", description: "", style_prompt: "", vocabulary: "", created_at: 0 }
      : editingId !== null
        ? profiles.find((p) => p.id === editingId) ?? null
        : null;

  return (
    <PageLayout
      title="Profiles"
      actions={
        <Button size="sm" onClick={() => setEditingId("new")}>
          + New profile
        </Button>
      }
    >
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollable">
        <div className="flex flex-col gap-2 max-w-[640px]">
          {profiles.map((p) => (
            <ProfileRow
              key={p.id}
              profile={p}
              isActive={p.id === activeId}
              onEdit={() => setEditingId(p.id)}
              onSetActive={() => handleSetActive(p.id)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
          {profiles.length === 0 && (
            <p className="text-muted-foreground text-body">
              No profiles yet. Create one to get started.
            </p>
          )}
        </div>
      </div>

      <ProfileEditor
        open={editing !== null}
        onOpenChange={(open) => !open && setEditingId(null)}
        profile={editing}
        isNew={editingId === "new"}
        onSaved={() => {
          setEditingId(null);
          setRefreshTick((n) => n + 1);
        }}
      />
    </PageLayout>
  );
}

function ProfileRow({
  profile,
  isActive,
  onEdit,
  onSetActive,
  onDelete,
}: {
  profile: Profile;
  isActive: boolean;
  onEdit: () => void;
  onSetActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-md border border-border bg-card ${isActive ? "ring-2 ring-primary/30" : ""}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-body font-medium text-foreground">
              {profile.name}
            </span>
            {isActive && (
              <span className="text-tag font-medium uppercase tracking-wide text-primary">
                Active
              </span>
            )}
          </div>
          {profile.description && (
            <p className="text-footnote text-muted-foreground mt-1 line-clamp-2">
              {profile.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSetActive}
            >
              Use
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete profile"
            onClick={onDelete}
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditor({
  open,
  onOpenChange,
  profile,
  isNew,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
  isNew: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        {profile && (
          <ProfileEditorBody
            key={profile.id || "new"}
            profile={profile}
            isNew={isNew}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditorBody({
  profile,
  isNew,
  onClose,
  onSaved,
}: {
  profile: Profile;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description);
  const [stylePrompt, setStylePrompt] = useState(profile.style_prompt);
  const [vocabulary, setVocabulary] = useState(profile.vocabulary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await commands.createProfile({
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
        });
      } else {
        await commands.updateProfile({
          id: profile.id,
          name: name.trim(),
          description: description.trim(),
          style_prompt: stylePrompt,
          vocabulary,
        });
      }
      onSaved();
    } catch (err) {
      console.error("save profile failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isNew ? "New profile" : `Edit ${profile.name}`}</DialogTitle>
        <DialogDescription>
          Profiles change how Ollama formats the cleaned output and what
          terms Whisper biases toward.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Quick reply"
            autoFocus
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
            rows={5}
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder="STYLE: Format the output as…"
          />
        </Field>

        <Field
          label="Vocabulary seeds"
          hint="Comma-separated terms biased into Whisper's transcription. Stacks with the global Vocabulary section."
        >
          <Textarea
            rows={3}
            value={vocabulary}
            onChange={(e) => setVocabulary(e.target.value)}
            placeholder="TypeScript, Tauri, Whisper"
          />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : isNew ? "Create" : "Save"}
        </Button>
      </DialogFooter>
    </>
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
    <div className="flex flex-col gap-1.5">
      <div>
        <div className="text-body font-medium text-foreground">{label}</div>
        {hint && (
          <div className="text-footnote text-muted-foreground leading-snug mt-0.5">
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
      />
    </svg>
  );
}
