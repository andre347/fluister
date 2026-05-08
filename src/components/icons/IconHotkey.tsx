import { Icon, type IconProps } from "./Icon";

export function IconHotkey(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 11h.5M11 11h.5M15 11h.5M7 15h10" />
    </Icon>
  );
}
