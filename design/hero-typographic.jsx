// Hero · Direction 3 — "Bold Typographic"
// Arc-leaning. Massive Fluister wordmark fills hero, animated pill anchored at
// bottom-center, single big amber dot for color. Confident, big-type-forward.

function HeroTypographic() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#0f0c0a", color: "#f6efe1",
      fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* nav */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "22px 40px",
        position: "relative", zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: "var(--amber)" }} />
          Fluister
        </div>
        <nav style={{ display: "flex", gap: 28, fontSize: 13, color: "rgba(246,239,225,0.65)" }}>
          <a style={{ color: "inherit", textDecoration: "none" }}>How it works</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>Privacy</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>FAQ</a>
          <a style={{ color: "inherit", textDecoration: "none" }}>GitHub</a>
        </nav>
        <button style={{
          background: "var(--amber)", color: "#231c12", border: 0,
          borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
        }}>Download</button>
      </header>

      {/* big wordmark backdrop */}
      <main style={{
        flex: 1, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 40px",
      }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 320, lineHeight: 0.85, letterSpacing: -14,
          margin: 0,
          color: "transparent",
          WebkitTextStroke: "1px rgba(246,239,225,0.16)",
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          userSelect: "none",
        }}>
          fluister
        </h1>

        {/* foreground stack */}
        <div style={{
          position: "relative", zIndex: 1,
          textAlign: "center", maxWidth: 720,
        }}>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
            color: "var(--amber)", marginBottom: 22,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
            local-first dictation for macOS
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: 600,
            fontSize: 56, lineHeight: 1.04, letterSpacing: -1.4,
            textWrap: "balance",
          }}>
            Hold a key, speak,<br/>
            release.
            <span style={{
              display: "inline-block", marginLeft: 14, transform: "translateY(2px)",
              width: 18, height: 18, borderRadius: "50%", background: "var(--amber)",
              boxShadow: "0 0 24px rgba(232,169,97,0.5)",
            }} />
          </div>
          <p style={{
            fontSize: 16, lineHeight: 1.55, color: "rgba(246,239,225,0.65)",
            maxWidth: 480, margin: "20px auto 0", textWrap: "pretty",
          }}>
            Whisper transcribes on your Mac's GPU. Nothing uploads, nothing
            phones home. The cleaned transcript is pasted at your cursor
            in under two seconds.
          </p>

          <div style={{ display: "inline-flex", gap: 10, alignItems: "center", marginTop: 30 }}>
            <button style={{
              background: "var(--amber)", color: "#231c12",
              border: 0, borderRadius: 10, padding: "13px 20px",
              fontSize: 14, fontWeight: 600, fontFamily: "inherit",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>↓</span>
              Download for macOS
            </button>
            <button style={{
              background: "rgba(246,239,225,0.08)", color: "#f6efe1",
              border: "0.5px solid rgba(246,239,225,0.18)", borderRadius: 10,
              padding: "13px 18px", fontSize: 14, fontFamily: "inherit",
              fontWeight: 500, cursor: "pointer",
            }}>
              View on GitHub →
            </button>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "rgba(246,239,225,0.45)", marginTop: 14 }}>
            Free · macOS 14+ · Apple Silicon
          </div>
        </div>

        {/* anchored pill at bottom-center, like the real overlay */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 26, zIndex: 2 }}>
          <Pill />
        </div>
      </main>

      {/* base strip — comparison-ish primer */}
      <section style={{
        borderTop: "0.5px solid rgba(246,239,225,0.1)",
        padding: "20px 40px",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 28, color: "rgba(246,239,225,0.65)", fontSize: 12,
      }}>
        {[
          ["No cloud", "Whisper runs on Metal."],
          ["No sign-in", "Nothing to log into."],
          ["No subscription", "Free. ☕ if you like it."],
          ["No telemetry", "There is nothing to disclose."],
        ].map(([t, d]) => (
          <div key={t}>
            <div style={{ color: "#f6efe1", fontWeight: 600, fontSize: 13 }}>{t}</div>
            <div style={{ marginTop: 4, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

window.HeroTypographic = HeroTypographic;
