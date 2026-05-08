// Mount everything in a DesignCanvas.
const { DesignCanvas, DCSection, DCArtboard, DCPostIt } = window;

function App() {
  return (
    <DesignCanvas
      title="Fluister · App redesign v2"
      subtitle="Native macOS — restrained chrome, system materials, brand peach as accent only. The serif lives only in the wordmark."
    >
      <DCSection
        id="hud"
        title="Recording HUD"
        subtitle="The floating pill — translucent vibrancy material, system red dot, peach only on the active profile marker. Picker slides down on ⌥."
      >
        <DCArtboard id="hud-pill" label="01 · Pill (idle)" width={760} height={220}>
          <RecordingHUD />
        </DCArtboard>
        <DCArtboard id="hud-picker" label="02 · Pill + profile picker" width={760} height={460}>
          <RecordingHUD withPicker />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="history"
        title="History · 3-pane"
        subtitle="Sidebar (filters) · list · detail. Detail pane has a real waveform scrubber, raw + cleaned both visible, a small 'cleanup edits' callout that's the brand-relevant moment."
      >
        <DCArtboard id="history" label="03 · History" width={1180} height={740}>
          <HistoryScreen />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="profiles"
        title="Profiles · sidebar + editor"
        subtitle="Live cleanup preview at the bottom is new — type the prompt, see the difference. App-targeting chips replace the old free-text app field."
      >
        <DCArtboard id="profiles" label="04 · Profiles" width={1180} height={740}>
          <ProfilesScreen />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="vocab"
        title="Vocabulary · table"
        subtitle="Term · what Whisper hears (alias chips) · hits · profiles. Inline-add row at top, drag to reorder, sidebar scopes by usage and profile."
      >
        <DCArtboard id="vocab" label="05 · Vocabulary" width={1180} height={740}>
          <VocabScreen />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="settings"
        title="Settings · macOS Sonoma-style"
        subtitle="Toolbar tabs at top — General / Recording / Cleanup / Hotkeys / Models / Storage / About. Hotkeys and Models get their own page now (previously buried). About is the single serif moment."
      >
        <DCArtboard id="settings-recording" label="06 · Recording prefs" width={760} height={620}>
          <SettingsScreen tab="recording" />
        </DCArtboard>
        <DCArtboard id="settings-about" label="07 · About" width={760} height={620}>
          <SettingsScreen tab="about" />
        </DCArtboard>
      </DCSection>

      <DCSection id="notes" title="System notes" subtitle="">
        <DCPostIt>
          <b>What changed from v1</b><br/>
          · Killed cream paper background — now subtly-warm white (#FAFAF7)<br/>
          · Killed oversized italic-serif headings<br/>
          · Native SF Pro everywhere in chrome; serif kept ONLY in the wordmark + About blurb<br/>
          · Peach is selection / dot / accent only — buttons mostly bordered-default<br/>
          · Native macOS toggles (26×15), segmented controls, NSToolbar-style chrome<br/>
          · Custom hand-drawn icon set (not Lucide)
        </DCPostIt>
        <DCPostIt color="#e9dfc4">
          <b>UX wins</b><br/>
          · History detail: real waveform scrubber + 'cleanup edits' summary<br/>
          · Profiles: live preview pane (raw → cleaned, side-by-side)<br/>
          · Profile picker in HUD (⌥1–4), shows current app→profile binding<br/>
          · Vocab: alias chips with inline delete; profile tags per term<br/>
          · Settings: Hotkeys and Models split out of General; About is the serif moment
        </DCPostIt>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
