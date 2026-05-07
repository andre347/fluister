// Popover (menu-bar dropdown) — 4 variations exploring content priority + density.

// Shell with the little notch arrow at top
function PopoverShell({ children, dark, anchor = 100, h = 360 }) {
  const bg = dark ? '#1a1714' : 'rgba(251, 248, 242, 0.92)';
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', padding: '12px 12px 12px', boxSizing: 'border-box', background: dark ? '#0e0c0a' : 'var(--paper-warm)' }}>
      {/* tray indicator */}
      <div style={{ position: 'absolute', top: 0, left: anchor - 8, width: 16, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="wave" style={{ height: 12, color: dark ? '#e8e3da' : '#2a2520' }}>
          <i style={{ height: 4 }}/><i style={{ height: 8 }}/><i style={{ height: 12 }}/><i style={{ height: 6 }}/><i style={{ height: 10 }}/>
        </div>
      </div>
      {/* notch */}
      <svg style={{ position: 'absolute', top: 8, left: anchor - 6 }} width="12" height="6" viewBox="0 0 12 6">
        <path d="M0 6 L6 0 L12 6 Z" fill={bg} stroke={dark ? '#3a342d' : '#2a2520'} strokeWidth="1"/>
        <line x1="0" y1="6" x2="12" y2="6" stroke={bg} strokeWidth="1.5"/>
      </svg>
      {/* popover body */}
      <div className={dark ? 'dark wf' : 'wf'} style={{ marginTop: 14, height: h - 26, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', background: bg, backdropFilter: 'blur(20px)' }}>
        {children}
      </div>
    </div>
  );
}

// ── A) Profile-dominant: big profile picker at top, toggles below ────────
function PopoverA() {
  return (
    <PopoverShell>
      <div className="lbl">profile</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {[['Default', false], ['Email', true], ['Slack', false], ['Notes', false], ['Code', false], ['+ New', false]].map(([n, on], i) => (
          <div key={i} className={'wf-soft'} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, background: on ? 'var(--amber)' : 'var(--paper)', borderColor: on ? 'var(--amber-ink)' : undefined, fontWeight: on ? 700 : 400 }}>
            {on && '● '}{n}
          </div>
        ))}
      </div>
      <div className="sep" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>AI cleanup</span><span className="tg on" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>Mute mic</span><span className="tg" />
      </div>
      <div className="sep" />
      <div className="menu-row hover" style={{ fontSize: 11 }}>⌒  Open History…</div>
      <div className="menu-row" style={{ fontSize: 11 }}>⚙  Settings…</div>
      <div style={{ flex: 1 }} />
      <div className="sep" />
      <div className="menu-row" style={{ fontSize: 11, color: 'var(--ink-fade)' }}>Quit Fluister  <span style={{ marginLeft: 'auto' }} className="mono">⌘Q</span></div>
    </PopoverShell>
  );
}

// ── B) Last-dictation visible at top (scrollable preview) ────────────────
function PopoverB() {
  return (
    <PopoverShell>
      <div className="lbl">last dictation · 10:42</div>
      <div className="wf-soft" style={{ padding: 8, borderRadius: 6, fontSize: 10, lineHeight: 1.4, background: 'var(--paper)', maxHeight: 70, overflow: 'hidden' }}>
        Hey Sam, can we move the design review to Thursday afternoon? I want to make sure we have time to walk…
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div className="chip amber" style={{ flex: 1, justifyContent: 'center' }}>⌘V paste</div>
        <div className="chip" style={{ flex: 1, justifyContent: 'center' }}>⌘C copy</div>
        <div className="chip" style={{ justifyContent: 'center' }}>★</div>
      </div>
      <div className="sep" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
        <div>Profile</div>
        <div className="chip amber">Email ▾</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>AI cleanup</span><span className="tg on" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>Mute mic</span><span className="tg" />
      </div>
      <div className="sep" />
      <div className="menu-row hover" style={{ fontSize: 11 }}>Open History…</div>
      <div className="menu-row" style={{ fontSize: 11 }}>Settings…</div>
      <div style={{ flex: 1 }} />
      <div className="menu-row" style={{ fontSize: 11, color: 'var(--ink-fade)' }}>Quit  <span className="mono" style={{ marginLeft: 'auto' }}>⌘Q</span></div>
    </PopoverShell>
  );
}

// ── C) Equal split, dark mode ────────────────────────────────────────────
function PopoverC() {
  return (
    <PopoverShell dark>
      <div className="lbl">profile</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', border: '1.25px solid var(--line)', borderRadius: 6, fontSize: 11 }}>
        <span>● <b>Email</b></span>
        <span className="hand" style={{ fontSize: 13, opacity: 0.6 }}>switch ›</span>
      </div>
      <div className="sep" />
      <div className="lbl">quick</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>AI cleanup</span><span className="tg on" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>Mute mic</span><span className="tg" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span>Auto-paste</span><span className="tg on" />
      </div>
      <div className="sep" />
      <div className="menu-row hover" style={{ fontSize: 11 }}>⌒  Open History…</div>
      <div className="menu-row" style={{ fontSize: 11 }}>⚙  Settings…</div>
      <div style={{ flex: 1 }} />
      <div className="sep" />
      <div className="menu-row" style={{ fontSize: 11, color: 'var(--ink-fade)' }}>Quit Fluister<span style={{ marginLeft: 'auto' }} className="mono">⌘Q</span></div>
    </PopoverShell>
  );
}

// ── D) Compact: single row of toggles, profile inline ────────────────────
function PopoverD() {
  return (
    <PopoverShell h={300}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="lbl">fluister</div>
        <div className="hand" style={{ fontSize: 11, color: 'var(--ink-fade)' }}>idle</div>
      </div>
      <div className="wf-soft" style={{ padding: '8px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11 }}>
          <div className="lbl">profile</div>
          <div style={{ fontWeight: 700 }}>Email</div>
        </div>
        <span className="chip">switch ▾</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div className="wf-soft" style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 10, textAlign: 'center', background: 'var(--paper)' }}>
          <div style={{ fontSize: 14 }}>✨</div>AI <span className="tg on" style={{ verticalAlign: 'middle', transform: 'scale(.7)' }}/>
        </div>
        <div className="wf-soft" style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 10, textAlign: 'center', background: 'var(--paper)' }}>
          <div style={{ fontSize: 14 }}>🎙</div>mic <span className="tg" style={{ verticalAlign: 'middle', transform: 'scale(.7)' }}/>
        </div>
        <div className="wf-soft" style={{ flex: 1, padding: 6, borderRadius: 6, fontSize: 10, textAlign: 'center', background: 'var(--paper)' }}>
          <div style={{ fontSize: 14 }}>↪</div>paste <span className="tg on" style={{ verticalAlign: 'middle', transform: 'scale(.7)' }}/>
        </div>
      </div>
      <div className="sep" />
      <div className="menu-row hover" style={{ fontSize: 11 }}>Open History…<span style={{ marginLeft: 'auto' }} className="mono">⌘H</span></div>
      <div className="menu-row" style={{ fontSize: 11 }}>Settings…<span style={{ marginLeft: 'auto' }} className="mono">⌘,</span></div>
      <div style={{ flex: 1 }} />
      <div className="menu-row" style={{ fontSize: 11, color: 'var(--ink-fade)' }}>Quit<span style={{ marginLeft: 'auto' }} className="mono">⌘Q</span></div>
    </PopoverShell>
  );
}

window.PopoverA = PopoverA;
window.PopoverB = PopoverB;
window.PopoverC = PopoverC;
window.PopoverD = PopoverD;
