import { Icon, type IconProps } from "./Icon";

export function IconPause(props: IconProps) {
  const fill = props.color ?? "currentColor";
  return (
    <Icon {...props} fill={fill} strokeWidth={0}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </Icon>
  );
}
