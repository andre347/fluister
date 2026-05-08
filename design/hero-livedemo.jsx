// Hero · Direction 4 — "Live Demo"
// The product front-and-center. A fake mac compose window sits in the middle
// of the hero; the recording pill is in its corner; the cleaned transcript
// types into the window in real time, cycling through Email → Slack → Notes
// → Code profiles.

function HeroLiveDemo() {
  const [profile, idx, setIdx] = useCycle(DEMO_PROFILES, 5200);

  return (
    <div style={{
      width: "100%", height: "100%",
      background:
        "radial-gradient(circle at 70% 30%, #f7eedc 0%, #f1ead9 35%, #ebe3cf 100%)",
      color: "var(--ink)",
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
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
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
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1.15fr)",
        gap: 56, alignItems: "center",
        padding: "0 56px 56px",
      }}>
        {/* left — short copy + cta */}
        <div style={{ maxWidth: 460 }}>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
            color: "var(--amber-ink)", marginBottom: 22,
          }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", marginRight: 8, transform: "translateY(-1px)" }} />
            Local-first dictation
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 56, lineHeight: 1.02, letterSpacing: -1.2,
            margin: 0, fontWeight: 600, textWrap: "balance",
          }}>
            What you say,<br/>
            already typed.
          </h1>

          <p style={{
            fontSize: 16, lineHeight: 1.55, color: "var(--ink-soft)",
            maxWidth: 420, marginTop: 24,
          }}>
            Hold <span className="kbd">⌥</span> from anywhere, dictate, release.
            Fluister transcribes on your Mac with Whisper, cleans up the
            text for the app you're in, and pastes it. No cloud, no
            sign-in, no telemetry.
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 30 }}>
            <button style={{
              background: "var(--amber)", color: "#231c12", border: 0,
              borderRadius: 10, padding: "13px 18px", fontSize: 14,
              fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
              boxShadow: "0 1px 0 rgba(255,255,255,0.5) inset",
            }}>
              <span style={{ fontSize: 13 }}>↓</span> Download for macOS
            </button>
            <button style={{
              background: "transparent", color: "var(--ink)",
              border: "0.5px solid var(--rule-strong)", borderRadius: 10,
              padding: "13px 16px", fontSize: 14, fontFamily: "inherit",
              fontWeight: 500, cursor: "pointer",
            }}>
              View on GitHub →
            </button>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 14 }}>
            Free · macOS 14+ · Apple Silicon
          </div>

          {/* profile dots */}
          <div style={{ marginTop: 44, display: "flex", alignItems: "center", gap: 8 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: 0.4, marginRight: 4 }}>
              CYCLING:
            </div>
            {DEMO_PROFILES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIdx(i)}
                style={{
                  border: "0.5px solid",
                  borderColor: i === idx ? "var(--amber-ink)" : "var(--rule-strong)",
                  background: i === idx ? "var(--amber)" : "transparent",
                  color: i === idx ? "#231c12" : "var(--ink-soft)",
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 0.4,
                  padding: "4px 9px", borderRadius: 999, cursor: "pointer",
                  transition: "all 200ms ease-out",
                }}
              >
                {p.name.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* right — live demo window */}
        <div style={{ position: "relative", height: 480, display: "flex", alignItems: "center" }}>
          <DemoWindow profile={profile} key={profile.id} />

          {/* pill anchored to the demo */}
          <div style={{ position: "absolute", right: -10, bottom: 6 }}>
            <Pill label={`hold ⌥ · ${profile.name.toLowerCase()}`} />
          </div>
        </div>
      </main>
    </div>
  );
}

function DemoWindow({ profile }) {
  // type the cleaned transcript over ~3.4s, then hold; the parent re-mounts on cycle
  const typed = useTypewriter(profile.cleaned, 3400);

  return (
    <MacWindow title={profile.title} width={580} height={420} style={{ marginLeft: "auto" }}>
      <div style={{ padding: "16px 22px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, height: "100%", boxSizing: "border-box" }}>
        {profile.contextLines.map((line, i) => (
          <div key={i} style={{
            display: "flex", gap: 10, padding: "6px 0",
            borderBottom: "0.5px solid var(--rule)",
          }}>
            <span style={{ color: "var(--ink-mute)", width: 64, flexShrink: 0, fontFamily: profile.id === "code" ? "var(--font-mono)" : "inherit", fontSize: profile.id === "code" ? 11 : 13 }}>{line[0]}</span>
            <span style={{ color: "var(--ink)", fontFamily: profile.id === "code" ? "var(--font-mono)" : "inherit", fontSize: profile.id === "code" ? 11 : 13 }}>{line[1]}</span>
          </div>
        ))}
        <div style={{
          paddingTop: 18, color: "var(--ink)",
          fontSize: profile.id === "code" ? 13 : 15,
          fontFamily: profile.id === "code" ? "var(--font-mono)" : "inherit",
          lineHeight: 1.55,
          textWrap: "pretty",
        }}>
          {profile.id === "code" && (
            <span style={{ color: "var(--ink-mute)" }}>{"// "}</span>
          )}
          <span style={{ color: profile.id === "code" ? "#6b8a4a" : "var(--ink)" }}>
            {typed.replace(/^\/\/\s*/, "")}
          </span>
          <span className="caret" />
        </div>
      </div>
    </MacWindow>
  );
}

window.HeroLiveDemo = HeroLiveDemo;
