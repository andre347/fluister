// Onboarding — 4 variations exploring step-count and shape

function OnbShell({ children, dark }) {
  return (
    <div className={dark ? 'dark wf' : 'wf'} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="tl"><span/><span/><span/></div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-fade)' }}>Welcome to Fluister</div>
      </div>
      {children}
    </div>
  );
}

// ── A) Multi-step stepper (4 steps with progress dots) ──────────────────
function OnbA() {
  return (
    <OnbShell>
      <div data-screen-label="Onboarding · A multi-step stepper" style={{ flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['Permissions', 'Model', 'AI cleanup', 'Done'].map((s, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 16, height: 16, borderRadius: 8, border: '1.25px solid var(--line)', background: i <= 1 ? 'var(--amber)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{i < 1 ? '✓' : i + 1}</span>
                <span className="lbl" style={{ fontSize: 8 }}>{s}</span>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 1, background: 'var(--line-ghost)' }}/>}
            </React.Fragment>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '0 30px' }}>
          <div style={{ fontSize: 32 }}>⌃</div>
          <div className="hand" style={{ fontSize: 22, fontWeight: 700 }}>Pick a Whisper model</div>
          <div className="note" style={{ maxWidth: 280, fontSize: 12 }}>
            Whisper runs on your Mac's GPU. Bigger model = better accuracy, more disk + RAM.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280 }}>
            {[
              ['Tiny', '75 MB', 'fastest'],
              ['Base', '142 MB', 'recommended'],
              ['Small', '466 MB', 'higher accuracy'],
              ['Medium', '1.5 GB', 'best for jargon'],
            ].map(([n, sz, note], i) => (
              <div key={i} className="wf-soft" style={{ padding: '8px 10px', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center', background: i === 1 ? 'var(--amber)' : 'transparent', borderColor: i === 1 ? 'var(--amber-ink)' : undefined, textAlign: 'left' }}>
                <span className={i === 1 ? 'rd on' : 'rd'} />
                <div style={{ fontSize: 11, flex: 1 }}><b>{n}</b> <span style={{ color: 'var(--ink-fade)' }}> · {sz}</span></div>
                <span style={{ fontSize: 9, color: 'var(--ink-fade)' }}>{note}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="lbl">step 2 of 4</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="chip">Back</div>
            <div className="chip amber">Download &amp; continue</div>
          </div>
        </div>
      </div>
    </OnbShell>
  );
}

// ── B) Single scrollable page (everything visible) ──────────────────────
function OnbB() {
  return (
    <OnbShell>
      <div data-screen-label="Onboarding · B single scrollable" style={{ flex: 1, padding: '18px 24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hand" style={{ fontSize: 26, fontWeight: 700 }}>Welcome to Fluister.</div>
        <div className="note" style={{ fontSize: 13 }}>Three quick things, all on this one page.</div>
        <div className="sep"/>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>1</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Permissions</div>
            <div className="note" style={{ fontSize: 11 }}>We need accessibility (to paste) + microphone.</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span className="chip">✓ Accessibility</span>
              <span className="chip" style={{ background: 'var(--amber)', borderColor: 'var(--amber-ink)' }}>Grant Microphone</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, border: '1.25px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>2</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>Whisper model</div>
            <div className="note" style={{ fontSize: 11 }}>Currently: <b>Base</b> (142 MB). Change in Settings later.</div>
            <div className="wf-soft" style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--paper-warm)', overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: 'var(--amber)' }}/>
            </div>
            <div style={{ fontSize: 9, color: 'var(--ink-fade)', marginTop: 2 }}>Downloading… 86 MB / 142 MB</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, border: '1.25px dashed var(--line-ghost)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'var(--ink-fade)' }}>3</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-soft)' }}>AI cleanup <span className="chip ghost" style={{ fontSize: 8, marginLeft: 4 }}>optional</span></div>
            <div className="note" style={{ fontSize: 11 }}>Install Ollama to clean up filler words and punctuation locally.</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 10 }}>
              <span className="chip ghost">↗ Get Ollama</span>
              <span className="chip ghost">Skip for now</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="chip amber">Done →</div>
        </div>
      </div>
    </OnbShell>
  );
}

// ── C) Hero step (one big focal task at a time, generous) ────────────────
function OnbC() {
  return (
    <OnbShell>
      <div data-screen-label="Onboarding · C hero single-focus" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 30px', gap: 14, textAlign: 'center' }}>
          <div className="x-box" style={{ width: 80, height: 80, borderRadius: 16 }}/>
          <div className="hand" style={{ fontSize: 28, fontWeight: 700 }}>Hold <span className="kbd" style={{ fontSize: 16, padding: '2px 8px' }}>⌥ right</span></div>
          <div className="hand" style={{ fontSize: 28, fontWeight: 700, marginTop: -8 }}>and try it.</div>
          <div className="note" style={{ fontSize: 13, maxWidth: 260 }}>
            We'll record while you hold, transcribe when you let go. Try saying <b>"hello fluister"</b> now.
          </div>
          <div className="wf-soft" style={{ width: 200, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ink-fade)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-fade)' }}/>
            <span style={{ fontSize: 10 }}>waiting for you to hold ⌥</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--line-soft)', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= 3 ? 'var(--ink)' : 'var(--ink-ghost)' }}/>)}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="chip">Skip</span>
            <span className="chip ghost">Next →</span>
          </div>
        </div>
      </div>
    </OnbShell>
  );
}

// ── D) Done / completion screen ──────────────────────────────────────────
function OnbD() {
  return (
    <OnbShell>
      <div data-screen-label="Onboarding · D done state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 30px', gap: 12, textAlign: 'center' }}>
        <div style={{ width: 70, height: 70, borderRadius: 35, border: '2px solid var(--amber-ink)', background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>✓</div>
        <div className="hand" style={{ fontSize: 26, fontWeight: 700 }}>You're set.</div>
        <div className="note" style={{ fontSize: 12, maxWidth: 280 }}>
          Fluister lives in your menu bar. Hold <span className="kbd">⌥</span> right anywhere on macOS, speak, release.
        </div>
        <div className="wf-soft" style={{ padding: 10, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10, alignSelf: 'stretch', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Whisper</span><span className="ink-fade">Base · ready</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Microphone</span><span className="ink-fade">granted</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Accessibility</span><span className="ink-fade">granted</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ollama (cleanup)</span><span className="ink-fade">skipped · enable later</span></div>
        </div>
        <div className="chip amber" style={{ padding: '4px 16px' }}>Start dictating</div>
      </div>
    </OnbShell>
  );
}

window.OnbA = OnbA;
window.OnbB = OnbB;
window.OnbC = OnbC;
window.OnbD = OnbD;
