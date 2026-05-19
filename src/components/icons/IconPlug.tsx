import { Icon, type IconProps } from "./Icon";

/// Two-prong electrical plug. Used as the Integrations tab icon — the
/// universally-recognised "connect this to that" glyph in apps like Slack,
/// Notion, Linear, Zapier.
export function IconPlug(props: IconProps) {
  return (
    <Icon strokeWidth={1.5} {...props}>
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M5 8h14" />
      <path d="M6 8v3a6 6 0 0 0 12 0V8" />
      <path d="M12 17v5" />
    </Icon>
  );
}
