import { Icon, type IconProps } from "./Icon";

export function IconHistory(props: IconProps) {
  const dotColor = props.color ?? "currentColor";
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
      <circle cx="18.5" cy="5.5" r="1.2" fill={dotColor} stroke="none" />
    </Icon>
  );
}
