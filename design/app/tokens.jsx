// Fluister · app — design tokens, atoms, icons.
// Native macOS Sonoma feel. Subtly-warm-white surfaces, system-grey ink,
// peach reserved for: recording dot, selection accent, the one serif moment
// (the Fluister wordmark). No oversized serif headings, no cream paper.

const FL = {
  // — Surfaces (subtly warm, not cream)
  windowBg: '#FAFAF7',          // window content background
  sidebarBg: 'rgba(245,245,242,0.72)', // translucent sidebar (vibrancy fake)
  sheetBg: '#FFFFFF',
  hover: 'rgba(0,0,0,0.04)',
  selection: 'rgba(232,169,97,0.16)',  // peach @ 16%
  selectionStrong: 'rgba(232,169,97,0.28)',
  fill: '#F2F2EF',              // recessed fill, like NSColor.quaternarySystemFill warmed

  // — Ink
  ink: '#1d1d1f',
  ink2: '#3c3c43cc',            // 80% — secondary label
  ink3: '#3c3c4399',            // 60% — tertiary label
  ink4: '#3c3c4366',            // 40% — quaternary
  inkInverse: '#ffffff',

  // — Lines
  hair: 'rgba(0,0,0,0.08)',
  hairStrong: 'rgba(0,0,0,0.14)',

  // — Brand accents (used sparingly)
  amber: '#E8A961',
  amberInk: '#B27A30',
  amberTint: '#F8E9CF',
  red: '#FF3B30',               // system red, for recording dot
  green: '#34C759',
  blue: '#0A84FF',              // system blue, used only for links
  yellow: '#FFD60A',

  // — Type
  sf: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
  sfDisplay: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  serif: '"Iowan Old Style", "Palatino", Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  // — Radii
  rWin: 10,
  rCard: 8,
  rCtl: 6,
  rPill: 999,
};

// ── Wordmark — the one serif moment ─────────────────────────
function Wordmark({ size = 13, dotSize, color = FL.ink, dotColor = FL.amberInk }) {
  return (
    <span style={{
      fontFamily: FL.serif, fontStyle: 'italic', fontWeight: 500,
      fontSize: size, letterSpacing: -0.3, color,
      lineHeight: 1, display: 'inline-flex', alignItems: 'baseline',
    }}>
      fluister<span style={{ color: dotColor }}>.</span>
    </span>
  );
}

// ── Window chrome ───────────────────────────────────────────
function MacWindow({ children, width = 1180, height = 740, sidebar = false, style }) {
  return (
    <div style={{
      width, height,
      background: FL.windowBg,
      borderRadius: FL.rWin,
      boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      fontFamily: FL.sf,
      color: FL.ink,
      fontSize: 13,
      position: 'relative',
      display: 'flex',
      ...style,
    }}>
      {children}
    </div>
  );
}

function TrafficLights({ inactive = false, style }) {
  const colors = inactive
    ? ['#d8d8d8', '#d8d8d8', '#d8d8d8']
    : ['#ff5f57', '#febc2e', '#28c840'];
  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      {colors.map((c, i) => (
        <span key={i} style={{
          width: 12, height: 12, borderRadius: '50%',
          background: c, boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)',
        }} />
      ))}
    </div>
  );
}

// ── Toolbar — 52px high, hairline divider ───────────────────
function Toolbar({ children, leading, style, height = 52 }) {
  return (
    <div style={{
      height, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 16px',
      borderBottom: `0.5px solid ${FL.hair}`,
      background: 'transparent',
      WebkitAppRegion: 'drag',
      ...style,
    }}>
      <TrafficLights />
      {leading && <div style={{ marginLeft: 12 }}>{leading}</div>}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' }}>
        {children}
      </div>
    </div>
  );
}

// ── Form atoms ──────────────────────────────────────────────
function Field({ value, placeholder, mono, width, monospace, multiline, rows = 4, style }) {
  const baseStyle = {
    width: width || '100%',
    padding: multiline ? '8px 10px' : '5px 9px',
    fontFamily: monospace ? FL.mono : FL.sf,
    fontSize: monospace ? 12 : 13,
    color: FL.ink,
    background: '#FFFFFF',
    border: `0.5px solid ${FL.hairStrong}`,
    borderRadius: FL.rCtl,
    boxShadow: '0 1px 0 rgba(0,0,0,0.02) inset',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'none',
    lineHeight: 1.5,
    ...style,
  };
  if (multiline) {
    return <textarea defaultValue={value} placeholder={placeholder} rows={rows} style={baseStyle} />;
  }
  return <input defaultValue={value} placeholder={placeholder} style={baseStyle} />;
}

function Btn({ children, kind = 'default', size = 'md', icon, style, onClick }) {
  const sizes = {
    sm: { padding: '3px 9px', fontSize: 11, height: 22, gap: 4 },
    md: { padding: '4px 11px', fontSize: 13, height: 26, gap: 6 },
    lg: { padding: '6px 14px', fontSize: 13, height: 32, gap: 8 },
  };
  const kinds = {
    // Native macOS bordered button
    default: {
      background: 'linear-gradient(#ffffff, #fafafa)',
      color: FL.ink,
      border: `0.5px solid ${FL.hairStrong}`,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
    },
    // Native default action — system blue tint, but here we use peach
    primary: {
      background: 'linear-gradient(#F0B574, #E29A4C)',
      color: '#3a2510',
      border: `0.5px solid ${FL.amberInk}`,
      boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 1px 1px rgba(178,122,48,0.2)',
    },
    // Plain — for toolbar icon buttons
    plain: {
      background: 'transparent', color: FL.ink2, border: '0.5px solid transparent',
    },
    danger: {
      background: 'linear-gradient(#ffffff, #fafafa)',
      color: FL.red,
      border: `0.5px solid ${FL.hairStrong}`,
    },
  };
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      ...sizes[size], ...kinds[kind],
      borderRadius: 5,
      fontFamily: FL.sf, fontWeight: 500,
      cursor: 'pointer', whiteSpace: 'nowrap',
      ...style,
    }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </button>
  );
}

// macOS-style toggle switch — 26×15
function Toggle({ on, accent = FL.amber }) {
  return (
    <span style={{
      width: 26, height: 15, borderRadius: 999,
      background: on ? accent : '#dcdcdc',
      position: 'relative', display: 'inline-block',
      transition: 'background .18s',
      boxShadow: on ? 'inset 0 1px 1px rgba(0,0,0,0.06)' : 'inset 0 1px 1px rgba(0,0,0,0.06)',
      flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 1, left: on ? 12 : 1,
        width: 13, height: 13, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.06)',
        transition: 'left .18s',
      }} />
    </span>
  );
}

// macOS-style segmented control
function Segmented({ options, value, onChange, size = 'md' }) {
  const h = size === 'sm' ? 22 : 26;
  return (
    <div style={{
      display: 'inline-flex',
      background: '#EAEAE8',
      borderRadius: 6,
      padding: 2,
      height: h,
      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.06)',
    }}>
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const selected = v === value;
        return (
          <button key={v} onClick={() => onChange?.(v)} style={{
            border: 0,
            background: selected ? '#FFFFFF' : 'transparent',
            color: FL.ink,
            fontSize: size === 'sm' ? 11 : 12, fontWeight: selected ? 500 : 400,
            padding: '0 11px',
            borderRadius: 4,
            boxShadow: selected ? '0 1px 1px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)' : 'none',
            cursor: 'pointer', fontFamily: FL.sf,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Tag/badge — minimal, neutral by default
function Tag({ children, tone = 'neutral', icon }) {
  const tones = {
    neutral: { bg: FL.fill, fg: FL.ink2 },
    amber:   { bg: FL.amberTint, fg: FL.amberInk },
    green:   { bg: '#DDF1D9', fg: '#346B2A' },
    blue:    { bg: '#DDE9FA', fg: '#0856B0' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 7px',
      fontFamily: FL.sf, fontSize: 11, fontWeight: 500,
      color: t.fg, background: t.bg,
      borderRadius: 4, lineHeight: 1.5, whiteSpace: 'nowrap',
    }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </span>
  );
}

// Keyboard shortcut display, e.g. ⌥Space
function Kbd({ children }) {
  return (
    <span style={{
      fontFamily: FL.sf, fontSize: 11, color: FL.ink3,
      letterSpacing: 0.5,
    }}>{children}</span>
  );
}

// Section group header — 11pt SF semibold uppercase like NSTableView headers
function GroupLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: FL.sf, fontSize: 11, fontWeight: 590,
      color: FL.ink3, letterSpacing: 0.4,
      textTransform: 'uppercase',
      padding: '14px 16px 4px',
      ...style,
    }}>{children}</div>
  );
}

// Subtle divider
function Divider({ style }) {
  return <div style={{ height: 0.5, background: FL.hair, width: '100%', ...style }} />;
}

Object.assign(window, {
  FL, Wordmark, MacWindow, TrafficLights, Toolbar,
  Field, Btn, Toggle, Segmented, Tag, Kbd, GroupLabel, Divider,
});
