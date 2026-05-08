// Fluister · custom icon set.
// Hand-drawn-feeling, slightly looser than Lucide. 1.4-1.6px stroke,
// rounded caps/joins, mostly outlined with one or two filled accents.
// Sized 16px by default. Pass color="…" to recolor the stroke.

function I({ children, size = 16, color = 'currentColor', fill = 'none', strokeWidth = 1.5, viewBox = '0 0 24 24' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill={fill}
         stroke={color} strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'inline-block', verticalAlign: '-2px' }}>
      {children}
    </svg>
  );
}

// Microphone — slightly soft, with a little stand
const IconMic = (p) => (
  <I {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M12 17v3" />
    <path d="M9 20.5h6" />
  </I>
);

// History — clock with a small recording tail
const IconHistory = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" />
    <circle cx="18.5" cy="5.5" r="1.2" fill={p?.color || 'currentColor'} stroke="none" />
  </I>
);

// Profile — stack of cards
const IconProfile = (p) => (
  <I {...p}>
    <rect x="4" y="6" width="16" height="13" rx="2" />
    <path d="M7 3.5h10" />
    <path d="M8.5 11h7" />
    <path d="M8.5 14.5h4" />
  </I>
);

// Vocabulary — a tag/label with a string
const IconVocab = (p) => (
  <I {...p}>
    <path d="M12 4.5h6.5a1.5 1.5 0 0 1 1.5 1.5v6.5L12 20.5l-8-8 8-8z" />
    <circle cx="15.5" cy="8.5" r="1.2" fill={p?.color || 'currentColor'} stroke="none" />
  </I>
);

// Settings — softer cog
const IconSettings = (p) => (
  <I {...p} strokeWidth={1.5}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </I>
);

// Models — cube/box that hints at "model file on disk"
const IconModels = (p) => (
  <I {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M4 7.5l8 4.5 8-4.5" />
    <path d="M12 12v9" />
  </I>
);

// Hotkeys — keycap shape
const IconHotkey = (p) => (
  <I {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 11h.5M11 11h.5M15 11h.5M7 15h10" />
  </I>
);

// Storage — folder with a small dot inside (where things live)
const IconStorage = (p) => (
  <I {...p}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11z" />
    <circle cx="12" cy="13" r="1.2" fill={p?.color || 'currentColor'} stroke="none" />
  </I>
);

// About — pillule mark (echoes the recording pill)
const IconAbout = (p) => (
  <I {...p}>
    <rect x="3" y="9" width="18" height="6" rx="3" />
    <circle cx="7" cy="12" r="1" fill={p?.color || 'currentColor'} stroke="none" />
    <path d="M11 12h6" strokeWidth={1.6} />
  </I>
);

// Search
const IconSearch = (p) => (
  <I {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M15.5 15.5L20 20" />
  </I>
);

// Plus
const IconPlus = (p) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);

// Star (filled when starred)
const IconStar = ({ filled, ...p }) => (
  <I {...p} fill={filled ? (p.color || 'currentColor') : 'none'}>
    <path d="M12 3.5l2.7 5.5 6 .9-4.4 4.3 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9L12 3.5z" />
  </I>
);

// Copy — overlapping rects
const IconCopy = (p) => (
  <I {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </I>
);

// Play / pause
const IconPlay = (p) => (
  <I {...p} fill={p?.color || 'currentColor'} strokeWidth={0}>
    <path d="M7 5l12 7-12 7V5z" />
  </I>
);
const IconPause = (p) => (
  <I {...p} fill={p?.color || 'currentColor'} strokeWidth={0}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </I>
);

// Trash — minimal
const IconTrash = (p) => (
  <I {...p}>
    <path d="M5 7h14" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    <path d="M7 7l1 11.5A1.5 1.5 0 0 0 9.5 20h5A1.5 1.5 0 0 0 16 18.5L17 7" />
  </I>
);

// Sparkle — for the cleanup toggle
const IconSparkle = (p) => (
  <I {...p}>
    <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
    <path d="M19 17l.7 1.6L21 19.5l-1.6.6L19 21.5l-.6-1.4L17 19.5l1.4-.5L19 17z" />
  </I>
);

// Chevron
const IconChevDown = (p) => (
  <I {...p}>
    <path d="M6 9l6 6 6-6" />
  </I>
);
const IconChevRight = (p) => (
  <I {...p}>
    <path d="M9 6l6 6-6 6" />
  </I>
);

// Drag handle — two dots column
const IconGrip = (p) => (
  <I {...p} fill={p?.color || 'currentColor'} strokeWidth={0}>
    <circle cx="9" cy="6" r="1.3" />
    <circle cx="9" cy="12" r="1.3" />
    <circle cx="9" cy="18" r="1.3" />
    <circle cx="15" cy="6" r="1.3" />
    <circle cx="15" cy="12" r="1.3" />
    <circle cx="15" cy="18" r="1.3" />
  </I>
);

// X (close on chips)
const IconX = (p) => (
  <I {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </I>
);

// Pencil — inline rename
const IconPencil = (p) => (
  <I {...p}>
    <path d="M14.5 4.5l5 5L9 20l-5.5.5L4 15 14.5 4.5z" />
  </I>
);

// Apple-ish app glyphs for "active in" indicators
const AppGlyphs = {
  mail: { bg: '#3686EE', glyph: '✉' },
  slack: { bg: '#4A154B', glyph: '#' },
  notes: { bg: '#FFC83D', glyph: '◰' },
  cursor: { bg: '#1A1A1A', glyph: '⟨/⟩' },
  safari: { bg: '#1F90D8', glyph: '⌖' },
  messages: { bg: '#34C759', glyph: '◌' },
};
function AppGlyph({ id, size = 16 }) {
  const a = AppGlyphs[id] || { bg: '#999', glyph: '•' };
  return (
    <span style={{
      width: size, height: size, borderRadius: 4,
      background: a.bg, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.55, fontWeight: 600, fontFamily: 'system-ui',
    }}>{a.glyph}</span>
  );
}

Object.assign(window, {
  IconMic, IconHistory, IconProfile, IconVocab, IconSettings,
  IconModels, IconHotkey, IconStorage, IconAbout, IconSearch, IconPlus,
  IconStar, IconCopy, IconPlay, IconPause, IconTrash, IconSparkle,
  IconChevDown, IconChevRight, IconGrip, IconX, IconPencil, AppGlyph,
});
