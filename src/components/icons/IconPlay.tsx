import { Icon, type IconProps } from "./Icon";

export function IconPlay(props: IconProps) {
  const fill = props.color ?? "currentColor";
  return (
    <Icon {...props} fill={fill} strokeWidth={0}>
      <path d="M7 5l12 7-12 7V5z" />
    </Icon>
  );
}
