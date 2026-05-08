import { Icon, type IconProps } from "./Icon";

interface StarProps extends IconProps {
  filled?: boolean;
}

export function IconStar({ filled, ...props }: StarProps) {
  const fill = filled ? props.color ?? "currentColor" : "none";
  return (
    <Icon {...props} fill={fill}>
      <path d="M12 3.5l2.7 5.5 6 .9-4.4 4.3 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9L12 3.5z" />
    </Icon>
  );
}
