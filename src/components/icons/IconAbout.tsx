import { Icon, type IconProps } from "./Icon";

export function IconAbout(props: IconProps) {
  const dotColor = props.color ?? "currentColor";
  return (
    <Icon {...props}>
      <rect x="3" y="9" width="18" height="6" rx="3" />
      <circle cx="7" cy="12" r="1" fill={dotColor} stroke="none" />
      <path d="M11 12h6" strokeWidth={1.6} />
    </Icon>
  );
}
