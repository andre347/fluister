// Settings — macOS Sonoma-style preferences with toolbar tabs at top.

function SettingsScreen({ tab = 'recording' }) {
  const tabs = [
    { id: 'general',  label: 'General',  icon: IconSettings },
    { id: 'recording', label: 'Recording', icon: IconMic },
    { id: 'cleanup', label: 'Cleanup',   icon: IconSparkle },
    { id: 'hotkeys', label: 'Hotkeys',   icon: IconHotkey },
    { id: 'models',  label: 'Models',    icon: IconModels },
    { id: 'storage', label: 'Storage',   icon: IconStorage },
    { id: 'about',   label: 'About',     icon: IconAbout },
  ];

  return (
    <MacWindow width={760} height={620}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Toolbar height={56} style={{ paddingBottom: 0 }}>
          <div style={{ flex: '0 0 60px' }}></div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const selected = t.id === tab;
              return (
                <button key={t.id} style={{
                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                  padding: '6px 10px',
                  background: selected ? FL.fill : 'transparent',
                  border: 0,
                  borderRadius: 6,
                  fontFamily: FL.sf, fontSize: 11, fontWeight: 500,
                  color: selected ? FL.ink : FL.ink2,
                  cursor: 'pointer',
                }}>
                  <Icon size={20} color={selected ? FL.ink : FL.ink2} strokeWidth={1.5} />
                  <span style={{ fontSize: 10.5, marginTop: 1 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ flex: '0 0 60px' }}></div>
        </Toolbar>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 60px 32px' }}>
          {tab === 'recording' && <RecordingPrefs />}
          {tab === 'about' && <AboutPrefs />}
        </div>
      </div>
    </MacWindow>
  );
}

function PrefRow({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'start', padding: '10px 0' }}>
      <div style={{ paddingTop: 3, textAlign: 'right' }}>
        <div style={{ fontSize: 13, color: FL.ink, fontWeight: 400 }}>{label}</div>
      </div>
      <div>
        {children}
        {hint && <div style={{ fontSize: 11, color: FL.ink3, marginTop: 4, lineHeight: 1.5, maxWidth: 380 }}>{hint}</div>}
      </div>
    </div>
  );
}

function PrefGroup({ title, children }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `0.5px solid ${FL.hair}`,
      borderRadius: 10,
      padding: '6px 18px',
      marginBottom: 18,
    }}>
      {title && <div style={{
        fontSize: 11, fontWeight: 590, color: FL.ink3,
        letterSpacing: 0.4, textTransform: 'uppercase',
        padding: '12px 0 4px',
      }}>{title}</div>}
      {React.Children.map(children, (child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{ height: 0.5, background: FL.hair, marginLeft: 204 }} />}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
}

function RecordingPrefs() {
  return (
    <div>
      <h2 style={{ margin: '0 0 16px 184px', fontSize: 17, fontWeight: 600, color: FL.ink, letterSpacing: -0.2 }}>
        Recording
      </h2>

      <PrefGroup>
        <PrefRow label="Hotkey" hint="Hold to talk, release to paste. Tap ⎋ to cancel.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyCapture value="⌥ Right Option" />
            <Btn size="sm" kind="plain">Change…</Btn>
          </div>
        </PrefRow>

        <PrefRow label="Auto-stop after silence" hint="Stops recording if you go quiet for this long.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle on />
            <Segmented
              options={[
                { value: '1', label: '1.0s' },
                { value: '1.5', label: '1.5s' },
                { value: '2', label: '2.0s' },
                { value: '3', label: '3.0s' },
              ]}
              value="1.5"
              size="sm"
            />
          </div>
        </PrefRow>

        <PrefRow label="Input device">
          <select style={{
            fontFamily: FL.sf, fontSize: 13,
            padding: '3px 24px 3px 9px', borderRadius: 5,
            border: `0.5px solid ${FL.hairStrong}`, background: '#FFFFFF',
            color: FL.ink,
          }}>
            <option>System default — MacBook Pro Microphone</option>
            <option>AirPods Pro</option>
          </select>
        </PrefRow>

        <PrefRow label="Show waveform" hint="The pill expands while you're speaking.">
          <Toggle on />
        </PrefRow>

        <PrefRow label="Pill position" hint="Where the recording pill appears. Drag to fine-tune.">
          <PositionPicker />
        </PrefRow>
      </PrefGroup>

      <PrefGroup title="Permissions">
        <PrefRow label="Microphone" hint="Required to capture audio for transcription.">
          <Tag tone="green" icon={<span style={{ width: 6, height: 6, borderRadius: '50%', background: '#346B2A' }} />}>Granted</Tag>
        </PrefRow>
        <PrefRow label="Accessibility" hint="Required to paste at the cursor in any app.">
          <Tag tone="green" icon={<span style={{ width: 6, height: 6, borderRadius: '50%', background: '#346B2A' }} />}>Granted</Tag>
        </PrefRow>
      </PrefGroup>
    </div>
  );
}

function KeyCapture({ value }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', minWidth: 130, height: 22,
      background: FL.fill, border: `0.5px solid ${FL.hair}`,
      borderRadius: 5,
      fontFamily: FL.sf, fontSize: 12, color: FL.ink, fontWeight: 500,
    }}>
      {value}
    </span>
  );
}

function PositionPicker() {
  const positions = [
    'tl', 't', 'tr',
    'l',  'c', 'r',
    'bl', 'b', 'br',
  ];
  const selected = 'b';
  return (
    <div style={{
      display: 'inline-grid', gridTemplateColumns: 'repeat(3, 24px)', gap: 4,
      padding: 6,
      background: FL.fill, border: `0.5px solid ${FL.hair}`,
      borderRadius: 6,
    }}>
      {positions.map((p) => (
        <button key={p} title={posLabel(p)} style={{
          width: 24, height: 18,
          background: p === selected ? FL.amber : '#FFFFFF',
          border: `0.5px solid ${p === selected ? FL.amberInk : FL.hair}`,
          borderRadius: 3,
          cursor: 'pointer', padding: 0,
        }} />
      ))}
    </div>
  );
}

function posLabel(p) {
  const map = { tl: 'Top-left', t: 'Top', tr: 'Top-right', l: 'Left', c: 'Center', r: 'Right', bl: 'Bottom-left', b: 'Bottom', br: 'Bottom-right' };
  return map[p];
}

function AboutPrefs() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, paddingTop: 12 }}>
      <span style={{
        width: 64, height: 64, borderRadius: 14,
        background: 'linear-gradient(180deg, #1f1a14, #0d0a08)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      }}>
        <span style={{
          width: 28, height: 8, borderRadius: 999,
          background: '#fbf8f2', display: 'inline-flex', alignItems: 'center', gap: 3, paddingLeft: 4,
        }}>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: FL.red }} />
          <span style={{ width: 1.5, height: 4, background: '#1a1714', borderRadius: 1 }} />
          <span style={{ width: 1.5, height: 5, background: '#1a1714', borderRadius: 1 }} />
          <span style={{ width: 1.5, height: 3, background: '#1a1714', borderRadius: 1 }} />
        </span>
      </span>
      <Wordmark size={28} color={FL.ink} dotColor={FL.amberInk} />
      <div style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3 }}>Version 1.0.0 · 14.2 MB</div>
      <div style={{ fontSize: 12, color: FL.ink2, lineHeight: 1.55, maxWidth: 360, fontStyle: 'italic', fontFamily: FL.serif }}>
        "fluister" — Dutch, to whisper. The sound your Mac makes when it does the work for you.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn size="sm">Check for updates…</Btn>
        <Btn size="sm">Source on GitHub</Btn>
        <Btn size="sm">☕ Buy me a coffee</Btn>
      </div>
      <div style={{ fontSize: 11, color: FL.ink4, marginTop: 12 }}>© 2026 · made on a Mac · MIT</div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
