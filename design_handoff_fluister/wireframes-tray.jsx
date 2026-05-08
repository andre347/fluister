// Tray icon states — small system menu-bar context

function TrayBar({ children, label }) {
  return (
    <div data-screen-label={'Tray · ' + label} style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(160deg, #d4c8b6, #b8a78d)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 12, fontSize: 10, color: '#2a2520' }}>
        <span></span>
        <b>Mail</b><span>File</span><span>Edit</span><span>View</span>
        <span style={{ marginLeft: 'auto' }}>⌃ ⏚ 📶 🔋</span>
        {/* tray icon spotlight */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, padding: '0 4px', borderRadius: 4, background: 'rgba(0,0,0,0.06)' }}>
          {children}
        </span>
        <span className="mono">10:42</span>
      </div>
      <div style={{ position: 'absolute', top: 50, left: 20, right: 20 }} className="hand">
        <div style={{ fontSize: 14, color: '#2a2520' }}>{label}</div>
      </div>
    </div>
  );
}

function Wave({ animated, color = '#2a2520', heights = [3, 7, 10, 5, 9] }) {
  return (
    <span className="wave" style={{ height: 12, color }}>
      {heights.map((h, i) => <i key={i} style={{ height: h }}/>)}
    </span>
  );
}

function TrayIdle()       { return <TrayBar label="Idle — neutral waveform"><Wave/></TrayBar>; }
function TrayRecording()  { return <TrayBar label="Recording — red dot + animated"><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c45844', marginRight: 3 }}/><Wave color="#c45844" heights={[4, 9, 12, 6, 10]}/></TrayBar>; }
function TrayProcessing() { return <TrayBar label="Transcribing — amber"><Wave color="#b27a30" heights={[5, 5, 5, 5, 5]}/></TrayBar>; }
function TrayMuted()      { return <TrayBar label="Mic muted — strike-through"><span style={{ position: 'relative', display: 'inline-flex' }}><Wave color="#8a7e72"/><span style={{ position: 'absolute', top: '50%', left: -2, right: -2, height: 1.2, background: '#c45844', transform: 'rotate(-18deg)' }}/></span></TrayBar>; }
function TrayPaused()     { return <TrayBar label="AI cleanup off — outlined only"><Wave color="#8a7e72"/></TrayBar>; }

window.TrayIdle = TrayIdle;
window.TrayRecording = TrayRecording;
window.TrayProcessing = TrayProcessing;
window.TrayMuted = TrayMuted;
window.TrayPaused = TrayPaused;
