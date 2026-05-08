import { Icon, type IconProps } from "./Icon";

export function IconStorage(props: IconProps) {
  const dotColor = props.color ?? "currentColor";
  return (
    <Icon {...props}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11z" />
      <circle cx="12" cy="13" r="1.2" fill={dotColor} stroke="none" />
    </Icon>
  );
}
