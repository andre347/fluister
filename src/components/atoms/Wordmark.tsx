interface WordmarkProps {
  size?: number;
  className?: string;
}

/** The one serif moment in the app — Iowan italic with a peach-ink dot.
 *  Used in the toolbar of every main-window section. */
export function Wordmark({ size = 13, className = "" }: WordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline leading-none text-ink ${className}`}
      style={{
        fontFamily: '"Iowan Old Style", "Palatino", Georgia, serif',
        fontStyle: "italic",
        fontWeight: 500,
        fontSize: size,
        letterSpacing: "-0.3px",
      }}
    >
      fluister
      <span className="text-amber-ink">.</span>
    </span>
  );
}
