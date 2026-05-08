// App entry — composes everything inside a DesignCanvas.

const { DesignCanvas, DCSection, DCArtboard, DCPostIt } = window;

function App() {
  return (
    <DesignCanvas
      title="Fluister · Marketing Site"
      subtitle="Hero direction explorations + wordmarks · pick one and I'll build the full single-page site"
    >
      <DCSection
        id="heroes"
        title="Hero & first scroll · 4 directions"
        subtitle="Each artboard is a 1280×760 frame at the canonical desktop size. Click a card's expand icon to view fullscreen."
      >
        <DCArtboard id="quiet" label="01 · Quiet Editorial" width={1280} height={760}>
          <HeroQuiet />
        </DCArtboard>

        <DCArtboard id="character" label="02 · Warm Character" width={1280} height={760}>
          <HeroCharacter />
        </DCArtboard>

        <DCArtboard id="typographic" label="03 · Bold Typographic (dark)" width={1280} height={760}>
          <HeroTypographic />
        </DCArtboard>

        <DCArtboard id="livedemo" label="04 · Live Demo" width={1280} height={760}>
          <HeroLiveDemo />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="wordmarks"
        title="Wordmark · 3 directions"
        subtitle="Tied to the heroes — each wordmark inherits the temperament of one direction."
      >
        <DCArtboard id="wm-sans" label="① Sans · pairs with 01 / 04" width={620} height={300}>
          <WordmarkSans />
        </DCArtboard>
        <DCArtboard id="wm-serif" label="② Italic serif · pairs with 02" width={620} height={300}>
          <WordmarkSerif />
        </DCArtboard>
        <DCArtboard id="wm-mono" label="③ Pill-as-mark · pairs with 03" width={620} height={300}>
          <WordmarkMono />
        </DCArtboard>
      </DCSection>

      <DCSection id="notes" title="Notes" subtitle="">
        <DCPostIt>
          <b>System rules I'm holding to:</b><br/>
          · single amber accent (#E8A961)<br/>
          · SF Pro + SF Mono only<br/>
          · 17/13/11/10 type scale in product chrome; site can scale up<br/>
          · 8/12pt radii, full pill for the HUD only<br/>
          · 180–220ms ease-out, no bounce<br/>
          · no gradient soup, no sparkles, no "AI-powered"
        </DCPostIt>
        <DCPostIt color="#e9dfc4">
          <b>Once you pick a hero direction</b>, I'll build the full single-page site as static HTML/CSS (no React, easy to hand to Claude Code). Sections planned: hero, local-first explainer, profiles with before/after, FAQ, download, footer.
        </DCPostIt>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
