// History window — 5 variations exploring layout structure, profile placement, and re-paste flow.

const HISTORY_ITEMS = [
  { day: 'Today', t: '10:42', text: 'Hey Sam, can we move the design review to Thursday afternoon? I want to make sure we have time to walk through the recording overlay variants together.', profile: 'Email', fav: true, len: 'long' },
  { day: 'Today', t: '10:14', text: 'todo: refactor the cleanup pipeline so ollama is called once per chunk', profile: 'Code', fav: false, len: 'short' },
  { day: 'Today', t: '09:51', text: 'lol same. brb getting coffee', profile: 'Slack', fav: false, len: 'short' },
  { day: 'Today', t: '09:30', text: '- ship onboarding rewrite\n- audit accessibility prompts\n- fix waveform jitter on M1', profile: 'Notes', fav: true, len: 'med' },
  { day: 'Yesterday', t: '17:22', text: 'Let me know if you have any objections to the proposed timeline.', profile: 'Email', fav: false, len: 'med' },
  { day: 'Yesterday', t: '14:08', text: 'pushing fix for the right-option hold latency now', profile: 'Slack', fav: false, len: 'short' },
  { day: 'Yesterday', t: '11:45', text: 'TypeScript inference broken on generic union narrowing', profile: 'Code', fav: false, len: 'short' },
  { day: 'Tue 4', t: '16:30', text: 'meeting notes: discussed q3 priorities, agreed on three workstreams', profile: 'Notes', fav: false, len: 'med' },
];

// ── A) Standard sidebar + list (the brief's reference layout) ─────────────
function HistoryA() {
  return (
    <div className="wf" data-screen-label="History · A standard sidebar" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* title bar */}
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--line-soft)', gap: 12 }}>
        <div className="tl"><span/><span/><span/></div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-fade)' }} className="hand">Fluister</div>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* sidebar */}
        <div style={{ width: 150, borderRight: '1px solid var(--line-soft)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--paper-warm)' }}>
          <div className="menu-row active">⌒ History</div>
          <div className="menu-row">◇ Profiles</div>
          <div className="menu-row">A Vocabulary</div>
          <div className="menu-row">⚙ Settings</div>
          <div style={{ flex: 1 }} />
          <div className="lbl" style={{ padding: '0 10px' }}>active profile</div>
          <div className="menu-row" style={{ border: '1.25px solid var(--line)', borderRadius: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} /> Email
          </div>
        </div>
        {/* main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '14px 16px', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }} className="underline-scribble">History</div>
            <div className="inp" style={{ width: 140 }}>⌕ search…</div>
          </div>
          <div className="lbl">Today</div>
          {HISTORY_ITEMS.filter(i => i.day === 'Today').map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px dashed var(--line-ghost)' }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-fade)', width: 36, paddingTop: 2 }}>{it.t}</div>
              <div style={{ flex: 1, fontSize: 11, lineHeight: 1.45 }}>{it.text.length > 90 ? it.text.slice(0, 88) + '…' : it.text}</div>
              <div style={{ display: 'flex', gap: 4, color: 'var(--ink-fade)', fontSize: 11 }}>
                {it.fav && <span style={{ color: 'var(--yellow)' }}>★</span>}
                <span>⌘C</span>
                <span>⋯</span>
              </div>
            </div>
          ))}
          <div className="lbl">Yesterday</div>
          {HISTORY_ITEMS.filter(i => i.day === 'Yesterday').slice(0, 2).map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px dashed var(--line-ghost)' }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-fade)', width: 36, paddingTop: 2 }}>{it.t}</div>
              <div style={{ flex: 1, fontSize: 11, lineHeight: 1.45 }}>{it.text.slice(0, 88)}…</div>
              <div style={{ display: 'flex', gap: 4, color: 'var(--ink-fade)', fontSize: 11 }}>⌘C ⋯</div>
            </div>
          ))}
        </div>
      </div>
      {/* margin annotations */}
      <svg className="annot-svg annot" viewBox="0 0 580 480" preserveAspectRatio="none">
        <path d="M 30 60 Q 0 80 -10 110" stroke="var(--ink)" strokeWidth="1" fill="none" strokeDasharray="3 3"/>
      </svg>
    </div>
  );
}

// ── B) Three-pane: sidebar + list + detail (mail.app shape) ───────────────
function HistoryB() {
  return (
    <div className="wf" data-screen-label="History · B three-pane detail" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="tl"><span/><span/><span/></div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-fade)' }} className="hand">Fluister — History</div>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* sidebar - icon rail */}
        <div style={{ width: 44, borderRight: '1px solid var(--line-soft)', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--paper-warm)' }}>
          <div style={{ width: 28, height: 28, border: '1.25px solid var(--line)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>⌒</div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-fade)' }}>◇</div>
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-fade)' }}>A</div>
          <div style={{ flex: 1 }} />
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-fade)' }}>⚙</div>
        </div>
        {/* list */}
        <div style={{ width: 180, borderRight: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-soft)' }}>
            <div className="inp" style={{ fontSize: 10 }}>⌕ search history</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="lbl" style={{ padding: '8px 10px 4px' }}>Today</div>
            {HISTORY_ITEMS.filter(i => i.day === 'Today').map((it, i) => (
              <div key={i} style={{ padding: '6px 10px', borderBottom: '1px dashed var(--line-ghost)', background: i === 0 ? 'var(--amber)' : 'transparent', fontSize: 10, lineHeight: 1.35 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: i === 0 ? '#2a2520' : 'var(--ink-fade)', marginBottom: 2 }}>
                  <span>{it.profile}</span><span className="mono">{it.t}</span>
                </div>
                <div style={{ color: i === 0 ? '#2a2520' : 'var(--ink)' }}>{it.text.slice(0, 50)}{it.text.length > 50 ? '…' : ''}</div>
              </div>
            ))}
            <div className="lbl" style={{ padding: '8px 10px 4px' }}>Yesterday</div>
            {HISTORY_ITEMS.filter(i => i.day === 'Yesterday').slice(0, 2).map((it, i) => (
              <div key={i} style={{ padding: '6px 10px', borderBottom: '1px dashed var(--line-ghost)', fontSize: 10, lineHeight: 1.35 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink-fade)' }}>
                  <span>{it.profile}</span><span className="mono">{it.t}</span>
                </div>
                <div>{it.text.slice(0, 50)}…</div>
              </div>
            ))}
          </div>
        </div>
        {/* detail */}
        <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="lbl">today · 10:42 · email profile</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <div className="chip">★ favorite</div>
              <div className="chip amber">⌘V paste</div>
              <div className="chip">⌘C</div>
            </div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>{HISTORY_ITEMS[0].text}</div>
          <div className="sep" />
          <div className="lbl">raw transcript</div>
          <div className="code">hey sam can we move the design review to thursday afternoon i wanna make sure we have time to walk through the recording overlay variants together</div>
        </div>
      </div>
    </div>
  );
}

// ── C) Tabs at top (no sidebar) ──────────────────────────────────────────
function HistoryC() {
  return (
    <div className="wf" data-screen-label="History · C top tabs" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="tl"><span/><span/><span/></div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-fade)' }} className="hand">Fluister</div>
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '10px 14px 0', borderBottom: '1px solid var(--line)' }}>
        <div className="tab on">History</div>
        <div className="tab">Profiles</div>
        <div className="tab">Vocabulary</div>
        <div className="tab">Settings</div>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="inp" style={{ flex: 1 }}>⌕ search 2 173 dictations…</div>
        <div className="chip">all profiles ▾</div>
        <div className="chip">★ only</div>
      </div>
      <div style={{ flex: 1, padding: '0 18px 14px', overflow: 'hidden' }}>
        <div className="lbl" style={{ marginBottom: 6 }}>Today</div>
        {HISTORY_ITEMS.filter(i => i.day === 'Today').map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 50px 1fr auto', gap: 8, padding: '7px 0', borderBottom: '1px dashed var(--line-ghost)', alignItems: 'center', fontSize: 11 }}>
            <span className="chip" style={{ fontSize: 9, padding: '1px 6px' }}>{it.profile}</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-fade)' }}>{it.t}</span>
            <span style={{ lineHeight: 1.4 }}>{it.text.length > 70 ? it.text.slice(0, 68) + '…' : it.text}</span>
            <span style={{ display: 'flex', gap: 6, color: 'var(--ink-fade)', fontSize: 10 }}>
              {it.fav ? <span style={{ color: 'var(--yellow)' }}>★</span> : <span>☆</span>}
              <span>⌘V</span>
              <span>⌘C</span>
              <span>⋯</span>
            </span>
          </div>
        ))}
        <div className="lbl" style={{ marginTop: 8, marginBottom: 6 }}>Yesterday</div>
        {HISTORY_ITEMS.filter(i => i.day === 'Yesterday').slice(0, 2).map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 50px 1fr auto', gap: 8, padding: '7px 0', borderBottom: '1px dashed var(--line-ghost)', alignItems: 'center', fontSize: 11 }}>
            <span className="chip" style={{ fontSize: 9, padding: '1px 6px' }}>{it.profile}</span>
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-fade)' }}>{it.t}</span>
            <span style={{ lineHeight: 1.4 }}>{it.text.slice(0, 68)}…</span>
            <span style={{ display: 'flex', gap: 6, color: 'var(--ink-fade)', fontSize: 10 }}>☆ ⌘V ⌘C ⋯</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── D) Card stream (chat-like, vertical timeline) ────────────────────────
function HistoryD() {
  return (
    <div className="wf" data-screen-label="History · D card stream" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="tl"><span/><span/><span/></div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--ink-fade)' }} className="hand">Fluister</div>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 140, borderRight: '1px solid var(--line-soft)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--paper-warm)' }}>
          <div className="menu-row active">History</div>
          <div className="menu-row">Profiles</div>
          <div className="menu-row">Vocabulary</div>
          <div className="menu-row">Settings</div>
        </div>
        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div className="lbl">Today, May 7</div>
          {HISTORY_ITEMS.filter(i => i.day === 'Today').slice(0, 3).map((it, i) => (
            <div key={i} className="wf-soft" style={{ borderRadius: 8, padding: '8px 10px', background: 'var(--paper)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 9 }}>
                  <span className="chip" style={{ fontSize: 9, padding: '0 5px' }}>{it.profile}</span>
                  <span className="mono" style={{ color: 'var(--ink-fade)' }}>{it.t}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-fade)' }}>{it.fav && <span style={{ color: 'var(--yellow)' }}>★ </span>}⋯</div>
              </div>
              <div style={{ fontSize: 11, lineHeight: 1.45 }}>{it.text.length > 110 ? it.text.slice(0, 108) + '…' : it.text}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 9, color: 'var(--ink-fade)' }}>
                <span>⌘V paste</span><span>⌘C copy</span><span>↻ redo cleanup</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── E) Spotlight-style command bar (search-first) ────────────────────────
function HistoryE() {
  return (
    <div className="wf" data-screen-label="History · E search-first" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 10px', borderBottom: '1px solid var(--line-soft)' }}>
        <div className="tl"><span/><span/><span/></div>
      </div>
      <div style={{ padding: '24px 28px 12px' }}>
        <div className="inp" style={{ fontSize: 18, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--ink-fade)' }}>⌕</span>
          <span>thursday</span>
          <span style={{ width: 1, height: 18, background: 'var(--ink)', marginLeft: 1, animation: 'b 1s steps(2) infinite' }}/>
          <span style={{ flex: 1 }}/>
          <span className="kbd">⌘K</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-fade)', marginTop: 6 }} className="hand">3 matches · profile:email · today</div>
      </div>
      <div style={{ flex: 1, padding: '0 28px 14px', overflow: 'hidden' }}>
        <div className="lbl">Top match</div>
        <div className="wf" style={{ marginTop: 6, padding: 12, borderRadius: 6, background: 'var(--amber)', borderColor: 'var(--amber-ink)' }}>
          <div style={{ fontSize: 9, marginBottom: 4 }}>Email · Today 10:42 · 38 words</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>Hey Sam, can we move the design review to <b style={{ background: '#fff', padding: '0 2px' }}>thursday</b> afternoon?…</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 10 }}>
            <span className="kbd">↵</span><span>paste</span>
            <span style={{ width: 8 }}/>
            <span className="kbd">⌘C</span><span>copy</span>
            <span style={{ width: 8 }}/>
            <span className="kbd">⌘D</span><span>delete</span>
          </div>
        </div>
        <div className="lbl" style={{ marginTop: 12 }}>Other matches</div>
        <div style={{ fontSize: 11, padding: '6px 0', borderBottom: '1px dashed var(--line-ghost)' }}>…meeting on <b>thursday</b> works either way…<span style={{ float: 'right', color: 'var(--ink-fade)', fontSize: 9 }}>yest 17:22</span></div>
        <div style={{ fontSize: 11, padding: '6px 0', borderBottom: '1px dashed var(--line-ghost)' }}>moving <b>thursday</b>'s standup<span style={{ float: 'right', color: 'var(--ink-fade)', fontSize: 9 }}>tue 4 16:30</span></div>
        <div style={{ marginTop: 14 }} className="lbl">…or jump to</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', fontSize: 10 }}>
          <div className="chip">⌘1 History</div>
          <div className="chip">⌘2 Profiles</div>
          <div className="chip">⌘3 Vocabulary</div>
          <div className="chip">⌘, Settings</div>
        </div>
      </div>
    </div>
  );
}

window.HistoryA = HistoryA;
window.HistoryB = HistoryB;
window.HistoryC = HistoryC;
window.HistoryD = HistoryD;
window.HistoryE = HistoryE;
