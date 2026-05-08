// Vocabulary — table layout, inline-add row, alias chips.

function VocabScreen() {
  const rows = [
    { term: 'Sam Lessin',   aliases: ['sam', 'samlesson'], hits: 47, profiles: ['email', 'slack'] },
    { term: 'Fluister',     aliases: ['floisture', 'fluster'], hits: 132, profiles: ['email', 'slack', 'notes'] },
    { term: 'TypeScript',   aliases: ['type script', 'type-script'], hits: 89, profiles: ['code'] },
    { term: 'Whisper',      aliases: ['wisper', 'wispr'], hits: 64, profiles: ['email', 'notes'] },
    { term: 'Ollama',       aliases: ['oh llama', 'olama', 'olla ma'], hits: 41, profiles: ['notes', 'code'] },
    { term: 'Tauri',        aliases: ['tory', 'taury'], hits: 28, profiles: ['code'] },
    { term: 'NSToolbar',    aliases: ['ns tool bar', 'ms toolbar'], hits: 12, profiles: ['code'] },
    { term: 'Marco Bianchi', aliases: ['marco', 'mark obianchi'], hits: 23, profiles: ['email', 'slack'] },
    { term: '⌘↑',           aliases: ['command up', 'cmd up'], hits: 7, profiles: ['code'] },
  ];

  return (
    <MacWindow width={1180} height={740}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Toolbar>
          <div style={{ flex: '0 0 220px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wordmark size={13} />
            <span style={{ color: FL.ink3, marginLeft: 6 }}>·</span>
            <span style={{ color: FL.ink2, fontWeight: 500 }}>Vocabulary</span>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <SearchBox placeholder="Filter terms" width={280} />
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', gap: 6 }}>
            <Btn kind="plain" size="sm">Import .csv</Btn>
            <Btn kind="primary" size="sm" icon={<IconPlus size={11} strokeWidth={2} />}>Add term</Btn>
          </div>
        </Toolbar>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* sidebar */}
          <div style={{
            width: 200, flexShrink: 0,
            background: FL.sidebarBg,
            backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
            borderRight: `0.5px solid ${FL.hair}`,
          }}>
            <GroupLabel>Scope</GroupLabel>
            <div style={{ padding: '0 8px' }}>
              {[
                { id: 'all', label: 'All terms', count: 87, selected: true },
                { id: 'frequent', label: 'Frequent', count: 24 },
                { id: 'unused', label: 'Unused', count: 11 },
              ].map((it) => (
                <div key={it.id} style={{
                  display: 'flex', alignItems: 'center', padding: '4px 8px', height: 24,
                  borderRadius: 5,
                  background: it.selected ? FL.selection : 'transparent',
                  fontSize: 13,
                }}>
                  <span style={{ flex: 1, fontWeight: it.selected ? 500 : 400 }}>{it.label}</span>
                  <span style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3 }}>{it.count}</span>
                </div>
              ))}
            </div>
            <GroupLabel>By profile</GroupLabel>
            <div style={{ padding: '0 8px' }}>
              {[
                { id: 'email', label: 'Email', count: 31, dot: FL.amber },
                { id: 'slack', label: 'Slack', count: 22, dot: '#5DA0E8' },
                { id: 'notes', label: 'Notes', count: 14, dot: '#A8C46B' },
                { id: 'code', label: 'Code', count: 28, dot: '#C77A8E' },
              ].map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', height: 24, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.dot }} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span style={{ fontFamily: FL.mono, fontSize: 11, color: FL.ink3 }}>{it.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* table */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '32px 1.2fr 2fr 80px 130px',
              padding: '8px 16px', alignItems: 'center', gap: 12,
              borderBottom: `0.5px solid ${FL.hair}`,
              background: '#F7F7F4',
              fontSize: 11, fontWeight: 590, color: FL.ink3,
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}>
              <span></span>
              <span>Term</span>
              <span>What Whisper hears</span>
              <span style={{ textAlign: 'right' }}>Hits</span>
              <span>Profiles</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* inline add row */}
              <InlineAddRow />
              {rows.map((r, i) => <VocabRow key={i} row={r} />)}
            </div>

            {/* footer */}
            <div style={{
              padding: '8px 16px', borderTop: `0.5px solid ${FL.hair}`,
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, color: FL.ink3, fontFamily: FL.mono,
              background: '#F7F7F4',
            }}>
              <span>87 terms · 412 aliases · trained against 1,247 transcripts</span>
              <span style={{ flex: 1 }} />
              <span>last sync · 2m ago</span>
            </div>
          </div>
        </div>
      </div>
    </MacWindow>
  );
}

function InlineAddRow() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px 1.2fr 2fr 80px 130px',
      padding: '8px 16px', alignItems: 'center', gap: 12,
      background: 'rgba(232,169,97,0.06)',
      borderBottom: `0.5px solid ${FL.hair}`,
    }}>
      <IconPlus size={14} color={FL.amberInk} strokeWidth={1.8} />
      <input placeholder="New term…" style={{
        border: 0, outline: 0, background: 'transparent',
        fontSize: 13, fontWeight: 500, color: FL.ink, fontFamily: FL.sf,
      }} />
      <input placeholder="aliases, comma-separated" style={{
        border: 0, outline: 0, background: 'transparent',
        fontSize: 12, color: FL.ink3, fontFamily: FL.mono,
      }} />
      <span></span>
      <Btn size="sm" kind="primary">Add ⏎</Btn>
    </div>
  );
}

function VocabRow({ row }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px 1.2fr 2fr 80px 130px',
      padding: '10px 16px', alignItems: 'center', gap: 12,
      borderBottom: `0.5px solid ${FL.hair}`,
      cursor: 'pointer',
    }}>
      <IconGrip size={14} color={FL.ink4} />
      <span style={{ fontSize: 13, fontWeight: 500, color: FL.ink }}>{row.term}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {row.aliases.map((a) => (
          <span key={a} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: FL.fill, border: `0.5px solid ${FL.hair}`,
            padding: '1px 4px 1px 7px',
            borderRadius: 4, fontFamily: FL.mono, fontSize: 11, color: FL.ink2,
          }}>
            {a}
            <button style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: FL.ink4, display: 'inline-flex' }}>
              <IconX size={9} strokeWidth={1.8} />
            </button>
          </span>
        ))}
        <button style={{
          background: 'transparent', border: `0.5px dashed ${FL.hairStrong}`,
          padding: '0 6px', borderRadius: 4,
          fontSize: 11, color: FL.ink3, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <IconPlus size={9} color={FL.ink3} strokeWidth={1.8} />
          alias
        </button>
      </div>
      <span style={{ textAlign: 'right', fontFamily: FL.mono, fontSize: 12, color: FL.ink2 }}>{row.hits}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {row.profiles.map((p) => {
          const colors = { email: FL.amber, slack: '#5DA0E8', notes: '#A8C46B', code: '#C77A8E' };
          return (
            <span key={p} style={{
              padding: '1px 6px', fontFamily: FL.mono, fontSize: 10,
              background: colors[p] + '22', color: 'rgba(0,0,0,0.7)',
              border: `0.5px solid ${colors[p]}66`,
              borderRadius: 3, fontWeight: 500,
            }}>{p}</span>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { VocabScreen });
