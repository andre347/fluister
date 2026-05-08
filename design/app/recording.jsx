// Recording HUD — the floating pill that appears when ⌥ is held.
// Native vibrancy material (translucent dark), not warm cream.
// Two states are shown: idle-recording and the slide-down profile picker.

function RecordingHUD({ withPicker }) {
  return (
    <div style={{
      width: 760, minHeight: 220,
      background: '#E9E5DC',
      backgroundImage: 'radial-gradient(circle at 30% 30%, #f4efe2, #e9e5dc 60%, #e0dbcd)',
      padding: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      borderRadius: 12,
    }}>
      <div style={{ position: 'relative' }}>
        <Pill withPicker={withPicker} />
        {withPicker && <ProfilePicker />}
      </div>
      <div style={{ fontFamily: FL.mono, fontSize: 11, color: '#7a6f5c' }}>
        ↑ release ⌥ to paste · tap ⎋ to cancel
      </div>
    </div>
  );
}

function Pill({ withPicker }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 12,
      padding: '8px 14px 8px 12px',
      background: 'rgba(28,24,20,0.86)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderRadius: 999,
      color: '#fbf8f2',
      boxShadow: '0 12px 36px rgba(15,10,5,0.30), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
      fontFamily: FL.sf, fontSize: 12,
      position: 'relative', zIndex: 2,
    }}>
      {/* recording dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: FL.red, boxShadow: '0 0 8px rgba(255,59,48,0.7)',
        animation: 'fluPulse 1.4s ease-in-out infinite',
      }} />
      <Wave bars={18} color="#fbf8f2" height={16} />
      <span style={{ fontFamily: FL.mono, fontSize: 11, color: '#cdc4b6', minWidth: 28 }}>0:04</span>
      <span style={{ width: 0.5, height: 12, background: 'rgba(255,255,255,0.18)' }} />
      <button style={{
        background: 'transparent', border: 0, color: '#fbf8f2',
        fontFamily: FL.sf, fontSize: 11, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '0 2px', cursor: 'pointer',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: FL.amber,
        }} />
        Email
        <IconChevDown size={10} color="#cdc4b6" strokeWidth={2} />
      </button>
      {withPicker && (
        <span style={{
          position: 'absolute', top: -22, right: 12,
          fontFamily: FL.mono, fontSize: 10, color: '#7a6f5c',
        }}>⌥1–4 to switch</span>
      )}
    </div>
  );
}

function Wave({ bars = 14, color = '#fbf8f2', height = 14 }) {
  // static-ish animated heights via inline keyframes per-bar phase
  const phases = React.useMemo(() => Array.from({length: bars}, () => Math.random() * 1.2), [bars]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height }}>
      {phases.map((p, i) => (
        <span key={i} style={{
          width: 2, height: '100%', borderRadius: 1, background: color, opacity: 0.92,
          animation: `fluWave 1.1s ease-in-out infinite`,
          animationDelay: `${-p}s`,
          transformOrigin: 'center',
        }} />
      ))}
    </span>
  );
}

function ProfilePicker() {
  const items = [
    { key: '⌥1', name: 'Email',   desc: 'sentence case · light punctuation',     active: true },
    { key: '⌥2', name: 'Slack',   desc: 'lowercase · casual · light emoji' },
    { key: '⌥3', name: 'Notes',   desc: 'sentence case · brisk · list-friendly' },
    { key: '⌥4', name: 'Code',    desc: 'comment style · symbols preserved' },
    { key: '⌥0', name: 'Raw',     desc: 'no cleanup — paste as-spoken', muted: true },
  ];
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
      width: 280,
      background: 'rgba(28,24,20,0.86)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderRadius: 10,
      boxShadow: '0 24px 60px rgba(15,10,5,0.4), 0 0 0 0.5px rgba(255,255,255,0.08) inset',
      padding: 6,
      zIndex: 1,
    }}>
      {items.map((it) => (
        <div key={it.key} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 10px',
          borderRadius: 6,
          background: it.active ? 'rgba(232,169,97,0.18)' : 'transparent',
          color: it.muted ? '#8a7f6e' : '#f1ece0',
        }}>
          <span style={{
            fontFamily: FL.mono, fontSize: 10, color: '#a89c87', minWidth: 24,
          }}>{it.key}</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: it.active ? 600 : 500 }}>{it.name}</span>
          <span style={{ fontSize: 10, color: '#8a7f6e', textAlign: 'right' }}>{it.desc}</span>
        </div>
      ))}
      <div style={{ height: 0.5, background: 'rgba(255,255,255,0.10)', margin: '4px 8px' }} />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', fontSize: 10, color: '#8a7f6e', fontFamily: FL.mono,
      }}>
        <span>profile follows app · Mail</span>
        <span>⏎ to lock</span>
      </div>
    </div>
  );
}

// global keyframes — injected once
if (typeof document !== 'undefined' && !document.getElementById('flu-anim')) {
  const s = document.createElement('style');
  s.id = 'flu-anim';
  s.textContent = `
@keyframes fluPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
@keyframes fluWave { 0%,100% { transform: scaleY(0.3) } 50% { transform: scaleY(1) } }
`;
  document.head.appendChild(s);
}

Object.assign(window, { RecordingHUD, Pill, Wave });
