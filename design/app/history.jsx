// History — three-pane layout: filters · list · detail.
// Detail pane has waveform scrubber, transcript, raw vs cleaned toggle.

function HistoryScreen() {
  return (
    <MacWindow width={1180} height={740}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Toolbar */}
        <Toolbar>
          <div style={{ flex: '0 0 220px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wordmark size={13} />
            <span style={{ color: FL.ink3, marginLeft: 6 }}>·</span>
            <span style={{ color: FL.ink2, fontWeight: 500 }}>History</span>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <SearchBox placeholder="Search transcripts" width={300} />
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', gap: 6 }}>
            <Btn kind="plain" icon={<IconStar size={14} />}></Btn>
            <Btn kind="plain" icon={<IconCopy size={14} />}></Btn>
            <Btn kind="plain" icon={<IconTrash size={14} />}></Btn>
          </div>
        </Toolbar>

        {/* Three panes */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <HistorySidebar />
          <HistoryList />
          <HistoryDetail />
        </div>
      </div>
    </MacWindow>
  );
}

function SearchBox({ placeholder, width = 240 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      width, height: 26,
      padding: '0 9px',
      background: '#FFFFFF',
      border: `0.5px solid ${FL.hairStrong}`,
      borderRadius: 6,
      boxShadow: '0 1px 0 rgba(0,0,0,0.02) inset',
    }}>
      <IconSearch size={13} color={FL.ink3} strokeWidth={1.7} />
      <input placeholder={placeholder} style={{
        border: 0, outline: 0, background: 'transparent',
        fontFamily: FL.sf, fontSize: 12, color: FL.ink,
        flex: 1, height: '100%',
      }} />
      <Kbd>⌘F</Kbd>
    </div>
  );
}

function HistorySidebar() {
  const groups = [
    {
      title: '',
      items: [
        { id: 'all',     label: 'All',          count: 1247, icon: <IconHistory size={14} /> },
        { id: 'today',   label: 'Today',        count: 8,    icon: <IconHistory size={14} /> },
        { id: 'starred', label: 'Starred',      count: 23,   icon: <IconStar size={14} /> },
      ],
    },
    {
      title: 'By app',
      items: [
        { id: 'mail',    label: 'Mail',     count: 312, glyph: <AppGlyph id="mail" size={14} /> },
        { id: 'slack',   label: 'Slack',    count: 489, glyph: <AppGlyph id="slack" size={14} /> },
        { id: 'cursor',  label: 'Cursor',   count: 187, glyph: <AppGlyph id="cursor" size={14} /> },
        { id: 'notes',   label: 'Notes',    count: 142, glyph: <AppGlyph id="notes" size={14} /> },
      ],
    },
    {
      title: 'By profile',
      items: [
        { id: 'p-email', label: 'Email',    count: 312, dot: FL.amber },
        { id: 'p-slack', label: 'Slack',    count: 489, dot: '#5DA0E8' },
        { id: 'p-notes', label: 'Notes',    count: 142, dot: '#A8C46B' },
        { id: 'p-code',  label: 'Code',     count: 187, dot: '#C77A8E' },
        { id: 'p-raw',   label: 'Raw',      count: 117, dot: FL.ink4 },
      ],
    },
  ];
  return (
    <div style={{
      width: 200, flexShrink: 0,
      background: FL.sidebarBg,
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderRight: `0.5px solid ${FL.hair}`,
      paddingTop: 4, paddingBottom: 12,
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <GroupLabel>{g.title}</GroupLabel>}
          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {g.items.map((it) => (
              <SidebarRow key={it.id} item={it} selected={it.id === 'today'} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarRow({ item, selected }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 8px', height: 24,
      borderRadius: 5,
      background: selected ? FL.selection : 'transparent',
      color: FL.ink, fontSize: 13,
    }}>
      <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: FL.ink2 }}>
        {item.icon || item.glyph || (item.dot && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot }} />
        ))}
      </span>
      <span style={{ flex: 1, fontWeight: selected ? 500 : 400 }}>{item.label}</span>
      <span style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3 }}>{item.count}</span>
    </div>
  );
}

function HistoryList() {
  const days = [
    {
      date: 'Today',
      items: [
        { time: '10:42', preview: "Hey Sam — could we move the design review to Thursday afternoon? I want to make sure we have time…", app: 'mail', dur: '0:08', selected: true, profile: 'Email', words: 24 },
        { time: '10:31', preview: "shipping popover variant B today — landing behind a flag while we wire up vibrancy 🛠️", app: 'slack', dur: '0:05', profile: 'Slack', words: 16 },
        { time: '09:54', preview: "// TODO: fix keyboard nav so ⌘↑ jumps to the first item in the day group.", app: 'cursor', dur: '0:04', profile: 'Code', words: 17 },
        { time: '09:18', preview: "Todo: follow up with Marco about the Whisper model picker. Onboarding step 3 is still rough.", app: 'notes', dur: '0:06', profile: 'Notes', words: 19 },
      ],
    },
    {
      date: 'Yesterday',
      items: [
        { time: '17:22', preview: "thanks for the review — pushing changes tomorrow morning, I'll ping you when it's ready", app: 'slack', dur: '0:05', profile: 'Slack', words: 18 },
        { time: '15:08', preview: "Could you double-check the diagram alignment in section 02? It looked a little off on retina.", app: 'mail', dur: '0:09', profile: 'Email', words: 22 },
        { time: '14:47', preview: "// HACK: the focus overlay needs an esc handler outside the React tree", app: 'cursor', dur: '0:04', profile: 'Code', words: 14, starred: true },
        { time: '11:34', preview: "remember to renew the developer cert before friday", app: 'notes', dur: '0:03', profile: 'Notes', words: 9 },
      ],
    },
  ];

  return (
    <div style={{
      width: 360, flexShrink: 0,
      borderRight: `0.5px solid ${FL.hair}`,
      background: '#FCFCFA',
      overflowY: 'auto',
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        background: 'rgba(252,252,250,0.85)',
        backdropFilter: 'blur(20px)',
        padding: '10px 16px',
        borderBottom: `0.5px solid ${FL.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: FL.ink2 }}>1,247 items</span>
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'clean', label: 'Cleaned' },
            { value: 'raw', label: 'Raw' },
          ]}
          value="all"
          size="sm"
        />
      </div>
      {days.map((d, i) => (
        <div key={i}>
          <div style={{
            padding: '12px 16px 4px',
            fontFamily: FL.sf, fontSize: 11, fontWeight: 590,
            color: FL.ink3, letterSpacing: 0.4, textTransform: 'uppercase',
          }}>{d.date}</div>
          {d.items.map((it, j) => (
            <ListRow key={j} item={it} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListRow({ item }) {
  return (
    <div style={{
      display: 'flex', gap: 10,
      padding: '10px 16px',
      background: item.selected ? FL.selection : 'transparent',
      borderBottom: `0.5px solid ${FL.hair}`,
      cursor: 'pointer',
    }}>
      <AppGlyph id={item.app} size={20} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, color: FL.ink, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{item.preview}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: FL.ink3, fontSize: 11 }}>
          <span style={{ fontFamily: FL.mono }}>{item.time}</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: FL.ink4 }} />
          <span style={{ fontFamily: FL.mono }}>{item.dur}</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: FL.ink4 }} />
          <span>{item.profile}</span>
          {item.starred && (
            <>
              <span style={{ flex: 1 }} />
              <IconStar size={11} filled color={FL.amber} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryDetail() {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      background: FL.windowBg,
    }}>
      {/* Detail header */}
      <div style={{
        padding: '16px 24px 12px',
        borderBottom: `0.5px solid ${FL.hair}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AppGlyph id="mail" size={16} />
          <span style={{ fontSize: 12, color: FL.ink2 }}>Mail</span>
          <span style={{ color: FL.ink4 }}>›</span>
          <span style={{ fontSize: 12, color: FL.ink2 }}>Compose · sam@studio.com</span>
          <span style={{ flex: 1 }} />
          <Tag tone="amber">Email</Tag>
          <span style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3 }}>Today · 10:42</span>
        </div>

        {/* Audio scrubber with waveform */}
        <ScrubberRow />
      </div>

      {/* Transcript */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{
          fontFamily: FL.sf, fontSize: 11, fontWeight: 590,
          color: FL.ink3, letterSpacing: 0.4, textTransform: 'uppercase',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>Cleaned</span>
          <Tag tone="neutral" icon={<IconSparkle size={10} />}>llama 3.2 · 1.0s</Tag>
        </div>
        <p style={{
          fontSize: 15, lineHeight: 1.55, color: FL.ink, margin: 0,
          textWrap: 'pretty',
        }}>
          Hey Sam — could we move the design review to Thursday afternoon? I want
          to make sure we have time to walk through the recording overlay variants
          together.
        </p>

        <div style={{
          marginTop: 24,
          fontFamily: FL.sf, fontSize: 11, fontWeight: 590,
          color: FL.ink3, letterSpacing: 0.4, textTransform: 'uppercase',
          marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>Raw transcript</span>
          <Tag tone="neutral">whisper-large-v3 · 0.7s</Tag>
        </div>
        <p style={{
          fontFamily: FL.mono, fontSize: 12.5, lineHeight: 1.6,
          color: FL.ink2, margin: 0,
        }}>
          hey sam can we move the design review to thursday afternoon i want to make
          sure we have time to walk through the recording overlay variants together
        </p>

        {/* Diff/changes (subtle, brand-relevant) */}
        <div style={{
          marginTop: 24, padding: '12px 14px',
          background: FL.fill, borderRadius: FL.rCard,
          fontSize: 12, color: FL.ink2, lineHeight: 1.6,
        }}>
          <div style={{ fontFamily: FL.mono, fontSize: 10, color: FL.ink3, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>
            cleanup edits · 4
          </div>
          <div>· Capitalized <em>Hey Sam</em> as a greeting</div>
          <div>· Inserted em-dash, comma, and question mark</div>
          <div>· Recognized <em>"Sam"</em> from your vocabulary</div>
          <div>· Sentence-cased the second clause</div>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 16px', borderTop: `0.5px solid ${FL.hair}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Btn icon={<IconCopy size={12} />}>Copy</Btn>
        <Btn icon={<IconSparkle size={12} />}>Re-clean…</Btn>
        <Btn icon={<IconStar size={12} />}>Star</Btn>
        <span style={{ flex: 1 }} />
        <Btn kind="danger" icon={<IconTrash size={12} />}>Delete</Btn>
      </div>
    </div>
  );
}

function ScrubberRow() {
  // 80 bars representing waveform — a real audio file is hinted at, not real audio
  const bars = React.useMemo(() => Array.from({ length: 80 }, (_, i) => {
    const t = i / 80;
    return 0.15 + Math.abs(Math.sin(t * 9 + 1.4) * 0.5 + Math.sin(t * 23) * 0.25) + Math.random() * 0.15;
  }), []);
  const playedTo = 0.42; // 42% played

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '4px 0',
    }}>
      <button style={{
        width: 26, height: 26, borderRadius: '50%',
        background: FL.amber, border: 0, color: '#3a2510',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 1px 2px rgba(178,122,48,0.25)',
      }}>
        <IconPlay size={11} color="#3a2510" />
      </button>
      <span style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3, minWidth: 30 }}>0:03</span>
      <div style={{
        flex: 1, height: 28,
        display: 'flex', alignItems: 'center', gap: 1.5,
        position: 'relative',
      }}>
        {bars.map((v, i) => {
          const played = (i / bars.length) <= playedTo;
          return (
            <span key={i} style={{
              flex: 1, minWidth: 1.5,
              height: Math.max(2, v * 22),
              borderRadius: 1,
              background: played ? FL.amberInk : FL.ink4,
              opacity: played ? 0.85 : 0.7,
            }} />
          );
        })}
        {/* playhead */}
        <span style={{
          position: 'absolute', top: 0, bottom: 0, left: `${playedTo * 100}%`,
          width: 1.5, background: FL.amberInk,
        }} />
      </div>
      <span style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3, minWidth: 30, textAlign: 'right' }}>0:08</span>
    </div>
  );
}

Object.assign(window, { HistoryScreen });
