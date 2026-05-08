// Wordmark explorations — three directions.

function WordmarkSans() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#fbf8f2",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "32px 40px", gap: 24,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--ink)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--amber)" }} />
        </span>
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: 56, fontWeight: 600, letterSpacing: -1.6,
          color: "var(--ink)",
        }}>
          Fluister
        </span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: 0.6 }}>
        ① · sf-pro display · amber dot inside black mark
      </div>
      <div style={{
        marginTop: 18, paddingTop: 18,
        borderTop: "0.5px solid var(--rule)",
        display: "flex", gap: 30, alignItems: "center",
      }}>
        {/* small variants */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, letterSpacing: -0.4 }}>
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)" }} />
          </span>
          Fluister
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>navbar size</div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--ink)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--amber)" }} />
          </span>
          Fluister
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>menubar size</div>
      </div>
    </div>
  );
}

function WordmarkSerif() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#f1ead9",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "32px 40px", gap: 24, position: "relative",
    }}>
      <div style={{
        fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
        fontStyle: "italic", fontWeight: 500,
        fontSize: 96, letterSpacing: -3, lineHeight: 1,
        color: "var(--ink)",
      }}>
        fluister<span style={{ color: "var(--amber-ink)" }}>.</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", letterSpacing: 0.6 }}>
        ② · italic serif · amber period · zine-y, warm
      </div>
      <div style={{
        marginTop: 8, paddingTop: 18,
        borderTop: "0.5px dashed var(--rule-strong)",
        display: "flex", gap: 28, alignItems: "baseline",
      }}>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 22 }}>
          fluister<span style={{ color: "var(--amber-ink)" }}>.</span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>navbar size</div>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 14 }}>
          fluister<span style={{ color: "var(--amber-ink)" }}>.</span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>footer size</div>
      </div>
    </div>
  );
}

function WordmarkMono() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "#0f0c0a",
      color: "#f6efe1",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "32px 40px", gap: 24,
    }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 14,
      }}>
        {/* the recording pill IS the wordmark — Fluister-as-product */}
        <span className="pill" style={{ paddingRight: 18 }}>
          <span className="dot" />
          <Wave bars={10} height={14} color="#fbf8f2" />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 18, letterSpacing: -0.4,
            color: "#fbf8f2", paddingLeft: 4,
          }}>
            fluister
          </span>
        </span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "rgba(246,239,225,0.55)", letterSpacing: 0.6 }}>
        ③ · the pill IS the mark · sf-mono · only works at scale
      </div>
      <div style={{
        marginTop: 8, paddingTop: 18,
        borderTop: "0.5px solid rgba(246,239,225,0.12)",
        display: "flex", gap: 22, alignItems: "center",
      }}>
        <span className="pill" style={{ padding: "5px 11px" }}>
          <span className="dot" />
          <Wave bars={6} height={11} color="#fbf8f2" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: -0.2, color: "#fbf8f2", paddingLeft: 2 }}>fluister</span>
        </span>
        <div className="mono" style={{ fontSize: 10, color: "rgba(246,239,225,0.45)" }}>navbar size</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#f6efe1", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)" }} />
          fluister
        </div>
        <div className="mono" style={{ fontSize: 10, color: "rgba(246,239,225,0.45)" }}>fallback (small)</div>
      </div>
    </div>
  );
}

window.WordmarkSans = WordmarkSans;
window.WordmarkSerif = WordmarkSerif;
window.WordmarkMono = WordmarkMono;
