interface AppGlyphProps {
  id: keyof typeof APP_GLYPHS;
  size?: number;
}

const APP_GLYPHS = {
  mail:     { bg: "#3686EE", glyph: "✉" },
  slack:    { bg: "#4A154B", glyph: "#" },
  notes:    { bg: "#FFC83D", glyph: "◰" },
  cursor:   { bg: "#1A1A1A", glyph: "⟨/⟩" },
  safari:   { bg: "#1F90D8", glyph: "⌖" },
  messages: { bg: "#34C759", glyph: "◌" },
} as const;

export function AppGlyph({ id, size = 16 }: AppGlyphProps) {
  const a = APP_GLYPHS[id];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: a.bg,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.55,
        fontWeight: 600,
        fontFamily: "system-ui",
      }}
    >
      {a.glyph}
    </span>
  );
}
