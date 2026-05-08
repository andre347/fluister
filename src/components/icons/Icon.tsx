import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "fill" | "stroke"> {
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  viewBox?: string;
}

interface InternalProps extends IconProps {
  children: ReactNode;
}

export function Icon({
  children,
  size = 16,
  color = "currentColor",
  fill = "none",
  strokeWidth = 1.5,
  viewBox = "0 0 24 24",
  style,
  ...rest
}: InternalProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-2px", ...style }}
      {...rest}
    >
      {children}
    </svg>
  );
}
