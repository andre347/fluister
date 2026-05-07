// Recording overlay HUD — 4 variations on the user's chosen pill shape.
// Each variant lives on a fake desktop background so the corner-anchored HUD reads as an HUD.

function DesktopBG({ children, dark }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: dark ? '#1a1714' : 'linear-gradient(160deg, #d4c8b6, #b8a78d 40%, #9a8870)' }}>
      {/* fake menu bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10, fontSize: 9, color: dark ? '#e8e3da' : '#2a2520', backdropFilter: 'blur(10px)' }}>
        <span></span><b>Mail</b><span>File</span><span>Edit</span><span>View</span>
        <span style={{ marginLeft: 'auto' }}>⌕  ⌃  ⏚  📶  🔋</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <span className="wave" style={{ height: 10, color: dark ? '#e8e3da' : '#2a2520' }}>
            <i style={{ height: 3 }}/><i style={{ height: 7 }}/><i style={{ height: 10 }}/><i style={{ height: 5 }}/>
          </span>
        </span>
        <span className="mono">10:42</span>
      </div>
      {/* fake window */}
      <div style={{ position: 'absolute', top: 36, left: 18, right: 18, bottom: 80, borderRadius: 8, background: dark ? '#221d18' : 'rgba(255,255,255,0.7)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ height: 22, borderBottom: `1px solid ${dark ? '#3a342d' : 'rgba(0,0,0,0.1)'}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }}/>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }}/>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }}/>
        </div>
        <div style={{ padding: 10, fontSize: 9, color: dark ? '#8a7e72' : '#4a4138', lineHeight: 1.5 }}>
          Compose<br/>To: sam@…<br/>Subject: design review<br/><br/>
          <span style={{ background: dark ? 'rgba(232,169,97,0.2)' : 'rgba(232,169,97,0.4)', padding: '0 2px' }}>cursor here ▎</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── A) Pill (the chosen style) — bottom right ───────────────────────────
function OverlayA() {
  return (
    <DesktopBG>
      <div data-screen-label="Overlay · A pill bottom-right" style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(26,23,20,0.92)', backdropFilter: 'blur(20px)', borderRadius: 999, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, color: '#fbf8f2', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }}/>
        <div className="wave" style={{ height: 14, color: '#fbf8f2' }}>
          <i style={{ height: 4 }}/><i style={{ height: 10 }}/><i style={{ height: 14 }}/><i style={{ height: 7 }}/><i style={{ height: 12 }}/><i style={{ height: 4 }}/><i style={{ height: 9 }}/><i style={{ height: 14 }}/><i style={{ height: 6 }}/><i style={{ height: 11 }}/><i style={{ height: 3 }}/><i style={{ height: 8 }}/>
        </div>
        <span className="mono" style={{ fontSize: 10, color: '#c8bfb4' }}>0:03</span>
      </div>
      {/* pill alt: just-released state, ghost */}
      <div style={{ position: 'absolute', top: 36, right: 14, background: 'rgba(26,23,20,0.7)', backdropFilter: 'blur(20px)', borderRadius: 999, padding: '4px 10px', fontSize: 9, color: '#fbf8f2' }}>
        ✓ pasted · 0.8s
      </div>
    </DesktopBG>
  );
}

// ── B) Pill — top center ─────────────────────────────────────────────────
function OverlayB() {
  return (
    <DesktopBG>
      <div data-screen-label="Overlay · B pill top-center" style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(26,23,20,0.92)', backdropFilter: 'blur(20px)', borderRadius: 999, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 10, color: '#fbf8f2', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }}/>
        <div className="wave" style={{ height: 12, color: '#fbf8f2' }}>
          <i style={{ height: 4 }}/><i style={{ height: 8 }}/><i style={{ height: 12 }}/><i style={{ height: 6 }}/><i style={{ height: 10 }}/><i style={{ height: 4 }}/><i style={{ height: 9 }}/><i style={{ height: 12 }}/>
        </div>
        <span className="hand" style={{ fontSize: 11, color: '#c8bfb4' }}>hold to dictate · email</span>
      </div>
    </DesktopBG>
  );
}

// ── C) Pill — bottom left, dark mac ──────────────────────────────────────
function OverlayC() {
  return (
    <DesktopBG dark>
      <div data-screen-label="Overlay · C bottom-left dark" style={{ position: 'absolute', bottom: 14, left: 14, background: 'rgba(245,239,226,0.18)', backdropFilter: 'blur(30px)', borderRadius: 999, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, color: '#fbf8f2', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '0.5px solid rgba(255,255,255,0.1)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }}/>
        <div className="wave" style={{ height: 14, color: '#fbf8f2' }}>
          <i style={{ height: 4 }}/><i style={{ height: 10 }}/><i style={{ height: 14 }}/><i style={{ height: 7 }}/><i style={{ height: 12 }}/><i style={{ height: 4 }}/><i style={{ height: 9 }}/><i style={{ height: 14 }}/><i style={{ height: 6 }}/><i style={{ height: 11 }}/>
        </div>
        <span className="mono" style={{ fontSize: 9, opacity: 0.7 }}>⌥ held</span>
      </div>
    </DesktopBG>
  );
}

// ── D) Pill — minimal dot only (most discreet) ───────────────────────────
function OverlayD() {
  return (
    <DesktopBG>
      <div data-screen-label="Overlay · D minimal dot" style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(26,23,20,0.92)', backdropFilter: 'blur(20px)', borderRadius: 999, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, color: '#fbf8f2' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 6px var(--red)' }}/>
        <span className="mono" style={{ fontSize: 9 }}>0:03</span>
      </div>
    </DesktopBG>
  );
}

// ── E) Pill — with live partial transcript preview ───────────────────────
function OverlayE() {
  return (
    <DesktopBG>
      <div data-screen-label="Overlay · E with partial transcript" style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(26,23,20,0.92)', backdropFilter: 'blur(20px)', borderRadius: 16, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, color: '#fbf8f2', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxWidth: 230 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }}/>
          <div className="wave" style={{ height: 12, color: '#fbf8f2', flex: 1 }}>
            {Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ height: [4, 8, 12, 6, 10, 4, 9, 12, 6, 11, 3, 8, 12, 5, 9, 4, 7, 11][i] }}/>)}
          </div>
          <span className="mono" style={{ fontSize: 9, color: '#c8bfb4' }}>0:03</span>
        </div>
        <div style={{ fontSize: 10, color: '#c8bfb4', fontStyle: 'italic', lineHeight: 1.3 }}>hey sam can we move the design</div>
      </div>
    </DesktopBG>
  );
}

window.OverlayA = OverlayA;
window.OverlayB = OverlayB;
window.OverlayC = OverlayC;
window.OverlayD = OverlayD;
window.OverlayE = OverlayE;
