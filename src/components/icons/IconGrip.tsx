import { Icon, type IconProps } from "./Icon";

export function IconGrip(props: IconProps) {
  const fill = props.color ?? "currentColor";
  return (
    <Icon {...props} fill={fill} strokeWidth={0}>
      <circle cx="9" cy="6" r="1.3" />
      <circle cx="9" cy="12" r="1.3" />
      <circle cx="9" cy="18" r="1.3" />
      <circle cx="15" cy="6" r="1.3" />
      <circle cx="15" cy="12" r="1.3" />
      <circle cx="15" cy="18" r="1.3" />
    </Icon>
  );
}
