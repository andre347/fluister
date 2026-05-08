// Hero · Direction 1 — "Quiet Editorial"
// Things-leaning. Generous whitespace, restrained type, big H1 in display sans,
// a single amber accent on the CTA, the recording-pill HUD floats inside a
// fake mac window vignette to the right.

function HeroQuiet() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#fbf8f2", color: "var(--ink)",
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* nav */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "22px 40px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, letterSpacing: -0.2 }}>
          <span style={{ width: 18, height: 18, borderRadius: 5, background: "var(--ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--amber)", fontSize: 11 }}>
            ●
          </span>
          Fluister
        </div>
        <nav style={{ display: "flex", gap: 28, fontSize: 13, color: "var(--ink-soft)" }}>
          <a style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>FAQ</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>GitHub</a>
        </nav>
        <button style={{
          background: "var(--ink)", color: "#fbf8f2", border: 0,
          borderRadius: 8, padding: "7px 13px", fontSize: 12,
          fontFamily: "inherit", fontWeight: 500, cursor: "pointer",
        }}>Download</button>
      </header>

      {/* hero body */}
      <main style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 60, alignItems: "center",
        padding: "0 64px 60px",
      }}>
        {/* left — copy */}
        <div>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
            color: "var(--amber-ink)", marginBottom: 28,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
            Local-first dictation for macOS
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 64, lineHeight: 1.04, letterSpacing: -1.4,
            margin: 0, fontWeight: 600,
            textWrap: "balance",
          }}>
            Hold a key.<br />
            Speak.<br />
            <span style={{ color: "var(--ink-mute)" }}>It's already pasted.</span>
          </h1>
          <p style={{
            fontSize: 17, lineHeight: 1.5, color: "var(--ink-soft)",
            maxWidth: 440, marginTop: 26, textWrap: "pretty",
          }}>
            Fluister is a tiny menu-bar dictation utility. Whisper transcribes
            on your Mac's GPU; nothing leaves the machine. No sign-in,
            no subscription, no telemetry.
          </p>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 36 }}>
            <button style={{
              background: "var(--amber)", color: "#231c12",
              border: 0, borderRadius: 10, padding: "12px 18px",
              fontSize: 14, fontWeight: 600, fontFamily: "inherit",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 2px rgba(178,122,48,0.2)",
            }}>
              <span style={{ fontSize: 13 }}>↓</span>
              Download for macOS
            </button>
            <button style={{
              background: "transparent", color: "var(--ink)",
              border: "0.5px solid var(--rule-strong)", borderRadius: 10,
              padding: "12px 16px", fontSize: 14, fontFamily: "inherit",
              fontWeight: 500, cursor: "pointer",
            }}>
              View on GitHub →
            </button>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 14 }}>
            Free · macOS 14+ · Apple Silicon
          </div>
        </div>

        {/* right — vignette */}
        <div style={{ position: "relative", height: 460 }}>
          {/* the vignette is a fake mac mail window with the recording pill in its corner */}
          <MacWindow title="New Message — Mail" width={520} height={400} style={{ position: "absolute", right: 0, top: 0 }}>
            <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              <div style={{ display: "flex", gap: 10, paddingBottom: 8, borderBottom: "0.5px solid var(--rule)" }}>
                <span style={{ color: "var(--ink-mute)", width: 56 }}>To:</span>
                <span style={{ color: "var(--ink)" }}>sam@studio.com</span>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--rule)" }}>
                <span style={{ color: "var(--ink-mute)", width: 56 }}>Subject:</span>
                <span style={{ color: "var(--ink)" }}>design review</span>
              </div>
              <div style={{ paddingTop: 16, color: "var(--ink)", fontSize: 14, lineHeight: 1.55 }}>
                <TypedLine text="Hey Sam — could we move the design review to Thursday afternoon? I want to make sure we have time to walk through the recording overlay variants together." />
              </div>
            </div>
          </MacWindow>

          {/* recording pill, perched */}
          <div style={{ position: "absolute", right: 22, bottom: 8 }}>
            <Pill />
          </div>

          {/* tiny floating annotation */}
          <div className="mono" style={{
            position: "absolute", left: -4, top: 30,
            fontSize: 10, color: "var(--ink-mute)", letterSpacing: 0.4,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ display: "inline-block", width: 24, height: 1, background: "var(--rule-strong)" }} />
            holding ⌥
          </div>
          <div className="mono" style={{
            position: "absolute", right: 0, bottom: -22,
            fontSize: 10, color: "var(--ink-mute)", letterSpacing: 0.4,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            recording &nbsp;·&nbsp; on-device
            <span style={{ display: "inline-block", width: 24, height: 1, background: "var(--rule-strong)" }} />
          </div>
        </div>
      </main>

      {/* first scroll teaser strip */}
      <section style={{
        borderTop: "0.5px solid var(--rule)",
        background: "#f4efe5",
        padding: "26px 64px",
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 40, alignItems: "start",
      }}>
        {[
          ["01", "Hold ⌥", "From anywhere on your Mac, a small pill slides into the corner."],
          ["02", "Speak", "Whisper transcribes locally on Metal. No round-trip."],
          ["03", "Release", "Cleaned text is pasted at the cursor in under two seconds."],
        ].map(([n, t, d]) => (
          <div key={n}>
            <div className="mono" style={{ fontSize: 10, color: "var(--amber-ink)", letterSpacing: 1.4 }}>
              STEP {n}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{t}</div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

// Type a sentence in over 4s, loop with a pause.
function TypedLine({ text }) {
  const [k, setK] = React.useState(0);
  const shown = useTypewriter(text, 3800, k);
  React.useEffect(() => {
    if (shown.length === text.length) {
      const id = setTimeout(() => setK((x) => x + 1), 1800);
      return () => clearTimeout(id);
    }
  }, [shown, text]);
  return (
    <span>
      {shown}
      <span className="caret" />
    </span>
  );
}

window.HeroQuiet = HeroQuiet;
