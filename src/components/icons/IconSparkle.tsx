import { Icon, type IconProps } from "./Icon";

export function IconSparkle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
      <path d="M19 17l.7 1.6L21 19.5l-1.6.6L19 21.5l-.6-1.4L17 19.5l1.4-.5L19 17z" />
    </Icon>
  );
}
