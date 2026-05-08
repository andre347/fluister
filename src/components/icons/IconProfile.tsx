import { Icon, type IconProps } from "./Icon";

export function IconProfile(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="6" width="16" height="13" rx="2" />
      <path d="M7 3.5h10" />
      <path d="M8.5 11h7" />
      <path d="M8.5 14.5h4" />
    </Icon>
  );
}
