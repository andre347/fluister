// Hero · Direction 2 — "Warm Character"
// Panic/Ivory-leaning. Cream paper, hand-set Fluister wordmark big,
// playful framing, mono captions like a zine. Recording pill below.

function HeroCharacter() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#f1ead9", color: "var(--ink)",
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* warm paper grain overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage:
          "radial-gradient(rgba(70,55,35,0.05) 1px, transparent 1px)",
        backgroundSize: "3px 3px", opacity: 0.6, mixBlendMode: "multiply",
      }} />

      {/* nav */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "22px 44px", position: "relative", zIndex: 1,
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
        }}>
          <DotMark />
          fluister
        </div>
        <nav className="mono" style={{ display: "flex", gap: 24, fontSize: 12, color: "var(--ink-soft)" }}>
          <a style={{ color: "inherit", textDecoration: "none" }}>how·it·works</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>privacy</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>faq</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>github↗</a>
        </nav>
        <a className="mono" style={{
          fontSize: 12, color: "var(--ink)", textDecoration: "none",
          background: "var(--amber)", padding: "6px 12px", borderRadius: 999,
          border: "0.5px solid rgba(178,122,48,0.4)",
        }}>download .dmg</a>
      </header>

      {/* big wordmark */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        padding: "8px 44px 32px",
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
          fontStyle: "italic", fontWeight: 500,
          fontSize: 184, lineHeight: 0.92, letterSpacing: -6,
          margin: "8px 0 0",
          color: "var(--ink)",
          textWrap: "balance",
        }}>
          fluister<span style={{ color: "var(--amber-ink)" }}>.</span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 32, marginTop: 18, alignItems: "end",
        }}>
          {/* left — etymology / pitch */}
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.7, color: "var(--ink-soft)" }}>
            <div style={{ color: "var(--ink-mute)" }}>noun · /ˈflœy̑.stər/ · Dutch</div>
            <div style={{ marginTop: 6, color: "var(--ink)" }}>
              to whisper; spoken softly so as not to be overheard.
            </div>
            <div style={{
              marginTop: 18, paddingTop: 14,
              borderTop: "0.5px dashed var(--rule-strong)",
              color: "var(--ink-soft)",
            }}>
              a tiny mac menu-bar app<br/>
              that turns held breath<br/>
              into pasted text.
            </div>
          </div>

          {/* center — the pill, framed */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Pill label="hold ⌥ · email profile" />
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: 0.6 }}>
              ↑ this is the entire app
            </div>
          </div>

          {/* right — CTAs as paper-tickets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <a style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: "var(--ink)", color: "#fbf8f2",
              padding: "14px 18px", borderRadius: 10,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
              boxShadow: "0 6px 0 rgba(26,23,20,0.15)",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6,
                background: "var(--amber)", color: "#231c12",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>↓</span>
              Download Fluister 1.0
            </a>
            <a className="mono" style={{
              fontSize: 11, color: "var(--ink-soft)", textDecoration: "none",
              borderBottom: "0.5px dashed var(--rule-strong)", paddingBottom: 1,
            }}>
              or read the source on github →
            </a>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 6 }}>
              free · buy me a coffee if you like it ☕
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>
              macOS 14+ · Apple Silicon
            </div>
          </div>
        </div>
      </main>

      {/* zine footer strip — shows the wedge */}
      <section style={{
        borderTop: "0.5px dashed var(--rule-strong)",
        padding: "16px 44px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)",
        position: "relative", zIndex: 1,
      }}>
        <span>↳ no cloud</span>
        <span>↳ no sign-in</span>
        <span>↳ no telemetry</span>
        <span>↳ no subscription</span>
        <span style={{ color: "var(--amber-ink)" }}>● just your mac</span>
      </section>
    </div>
  );
}

function DotMark() {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: "50%",
      background: "var(--ink)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
    </span>
  );
}

window.HeroCharacter = HeroCharacter;
