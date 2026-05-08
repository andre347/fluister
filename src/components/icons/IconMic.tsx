import { Icon, type IconProps } from "./Icon";

export function IconMic(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3" />
      <path d="M9 20.5h6" />
    </Icon>
  );
}
