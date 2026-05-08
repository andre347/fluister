// Main app — assembles all surfaces into the design canvas with a tweaks panel.

const { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakRadio, TweakSelect } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "annotations": true,
  "compactDensity": false,
  "boardWidth": 540
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.body.classList.toggle('no-annot', !t.annotations);
    document.body.classList.toggle('compact', t.compactDensity);
  }, [t.annotations, t.compactDensity]);

  React.useEffect(() => {
    const id = setTimeout(() => {
      const el = document.getElementById('intro');
      if (el) el.style.transition = 'opacity .5s'; if (el) el.style.opacity = '0';
    }, 5000);
    return () => clearTimeout(id);
  }, []);

  const W = t.boardWidth;
  // proportional sizes
  const histH = Math.round(W * 0.72);
  const popW = Math.round(W * 0.46);
  const popH = Math.round(popW * 1.28);
  const overW = W;
  const overH = Math.round(W * 0.6);
  const onbW = Math.round(W * 0.85);
  const onbH = Math.round(onbW * 0.75);
  const trayW = Math.round(W * 0.78);
  const trayH = 120;

  return (
    <React.Fragment>
      <DesignCanvas>
        <DCSection id="history" title="History window" subtitle="The main app surface — sidebar layout, three-pane, tabs, card-stream, search-first">
          <DCArtboard id="hA" label="A · Sidebar + list (brief default)" width={W} height={histH}><HistoryA/></DCArtboard>
          <DCArtboard id="hB" label="B · Three-pane with detail" width={W} height={histH}><HistoryB/></DCArtboard>
          <DCArtboard id="hC" label="C · Top tabs, no sidebar" width={W} height={histH}><HistoryC/></DCArtboard>
          <DCArtboard id="hD" label="D · Card stream timeline" width={W} height={histH}><HistoryD/></DCArtboard>
          <DCArtboard id="hE" label="E · Search-first command bar" width={W} height={histH}><HistoryE/></DCArtboard>
          <DCPostIt top={-50} left={W * 5 + 250} rotate={3} width={210}>
            <b>Recommend A or B.</b> A is closest to the brief; B adds detail-pane breathing room for long dictations + raw vs cleaned diff.
          </DCPostIt>
        </DCSection>

        <DCSection id="popover" title="Popover" subtitle="Menu-bar dropdown — Apple's Wi-Fi/Battery vocabulary">
          <DCArtboard id="pA" label="A · Profile-dominant grid" width={popW} height={popH}><PopoverA/></DCArtboard>
          <DCArtboard id="pB" label="B · Last dictation surfaced" width={popW} height={popH}><PopoverB/></DCArtboard>
          <DCArtboard id="pC" label="C · Equal split (dark)" width={popW} height={popH}><PopoverC/></DCArtboard>
          <DCArtboard id="pD" label="D · Compact tile toggles" width={popW} height={popH}><PopoverD/></DCArtboard>
          <DCPostIt top={-50} left={popW * 4 + 200} rotate={-2} width={200}>
            B is the most useful day-to-day — re-paste the last thing without opening History.
          </DCPostIt>
        </DCSection>

        <DCSection id="overlay" title="Recording overlay" subtitle="HUD pill — same shape, varying position + state. No window chrome.">
          <DCArtboard id="oA" label="A · Pill bottom-right (default)" width={overW} height={overH}><OverlayA/></DCArtboard>
          <DCArtboard id="oB" label="B · Pill top-center" width={overW} height={overH}><OverlayB/></DCArtboard>
          <DCArtboard id="oC" label="C · Pill bottom-left, dark" width={overW} height={overH}><OverlayC/></DCArtboard>
          <DCArtboard id="oD" label="D · Minimal dot only" width={overW} height={overH}><OverlayD/></DCArtboard>
          <DCArtboard id="oE" label="E · With live partial transcript" width={overW} height={overH}><OverlayE/></DCArtboard>
          <DCPostIt top={-50} left={overW * 3 + 200} rotate={2} width={210}>
            E is risky — partial transcript can distract while speaking. Make it a setting; default off.
          </DCPostIt>
        </DCSection>

        <DCSection id="onboarding" title="Onboarding" subtitle="First-run window — explore step count vs density">
          <DCArtboard id="nA" label="A · Multi-step stepper" width={onbW} height={onbH}><OnbA/></DCArtboard>
          <DCArtboard id="nB" label="B · Single scrollable page" width={onbW} height={onbH}><OnbB/></DCArtboard>
          <DCArtboard id="nC" label="C · Hero focus per step" width={onbW} height={onbH}><OnbC/></DCArtboard>
          <DCArtboard id="nD" label="D · Done / completion" width={onbW} height={onbH}><OnbD/></DCArtboard>
          <DCPostIt top={-50} left={onbW * 3 + 250} rotate={-3} width={200}>
            B (one-page) feels most macOS-utility. C earns its space only if you ship a "try-it" demo.
          </DCPostIt>
        </DCSection>

        <DCSection id="tray" title="Menu-bar icon states" subtitle="Idle · Recording · Transcribing · Muted · AI off">
          <DCArtboard id="tA" label="Idle" width={trayW} height={trayH}><TrayIdle/></DCArtboard>
          <DCArtboard id="tB" label="Recording" width={trayW} height={trayH}><TrayRecording/></DCArtboard>
          <DCArtboard id="tC" label="Transcribing" width={trayW} height={trayH}><TrayProcessing/></DCArtboard>
          <DCArtboard id="tD" label="Muted" width={trayW} height={trayH}><TrayMuted/></DCArtboard>
          <DCArtboard id="tE" label="AI cleanup off" width={trayW} height={trayH}><TrayPaused/></DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Display">
          <TweakToggle label="Show margin annotations" value={t.annotations} onChange={(v) => setTweak('annotations', v)} />
          <TweakToggle label="Compact density" value={t.compactDensity} onChange={(v) => setTweak('compactDensity', v)} />
        </TweakSection>
        <TweakSection label="Artboard size" />
        <TweakRadio label="Board width" value={t.boardWidth} options={[420, 540, 680]} onChange={(v) => setTweak('boardWidth', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
