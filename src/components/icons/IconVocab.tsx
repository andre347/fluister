import { Icon, type IconProps } from "./Icon";

export function IconVocab(props: IconProps) {
  const dotColor = props.color ?? "currentColor";
  return (
    <Icon {...props}>
      <path d="M12 4.5h6.5a1.5 1.5 0 0 1 1.5 1.5v6.5L12 20.5l-8-8 8-8z" />
      <circle cx="15.5" cy="8.5" r="1.2" fill={dotColor} stroke="none" />
    </Icon>
  );
}
