import type { Profile } from "./tauri";

/** Map profile name → CSS color for the small leading dot used everywhere
 *  the profile is referenced (sidebar rows, list rows, picker chip, etc.).
 *  Names are matched case-insensitively. Unknown profiles fall back to the
 *  brand amber. The colors themselves are tokens in `theme.css` so the
 *  raw hex values live in one place. */
export function profileDotColor(name: string | null | undefined): string {
  if (!name) return "var(--color-amber)";
  const key = name.trim().toLowerCase();
  if (key === "email" || key === "default") return "var(--color-amber)";
  if (key === "slack") return "var(--color-profile-slack)";
  if (key === "notes") return "var(--color-profile-notes)";
  if (key === "code") return "var(--color-profile-code)";
  if (key === "raw") return "var(--color-ink-4)";
  if (key.startsWith("standup")) return "var(--color-profile-standup)";
  if (key.startsWith("commit")) return "var(--color-profile-commit)";
  return "var(--color-amber)";
}

/** Convenience for components that hold a `Map<id, Profile>` and want to
 *  resolve dot color from a profile_id off a row. */
export function profileDotColorById(
  profileId: number | null | undefined,
  profiles: Profile[],
): string {
  if (profileId == null) return "var(--color-ink-4)";
  const p = profiles.find((x) => x.id === profileId);
  return profileDotColor(p?.name);
}
