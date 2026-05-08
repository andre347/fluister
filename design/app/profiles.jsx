// Profiles — sidebar list + detail editor with a live cleanup preview.

function ProfilesScreen() {
  return (
    <MacWindow width={1180} height={740}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Toolbar>
          <div style={{ flex: '0 0 220px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wordmark size={13} />
            <span style={{ color: FL.ink3, marginLeft: 6 }}>·</span>
            <span style={{ color: FL.ink2, fontWeight: 500 }}>Profiles</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ flex: '0 0 auto', display: 'flex', gap: 6 }}>
            <Btn kind="plain" icon={<IconPlus size={13} strokeWidth={1.7} />}>New profile</Btn>
          </div>
        </Toolbar>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <ProfileList />
          <ProfileEditor />
        </div>
      </div>
    </MacWindow>
  );
}

function ProfileList() {
  const built = [
    { id: 'email', name: 'Email',  desc: 'Sentence case, polite, em-dashes', dot: FL.amber, active: true, badge: 'Mail · Spark' },
    { id: 'slack', name: 'Slack',  desc: 'Lowercase, casual, light emoji',   dot: '#5DA0E8', badge: 'Slack · Discord' },
    { id: 'notes', name: 'Notes',  desc: 'Brisk, list-friendly',             dot: '#A8C46B', badge: 'Notes · Bear' },
    { id: 'code',  name: 'Code',   desc: 'Comment style, terse',             dot: '#C77A8E', badge: 'Cursor · Xcode' },
    { id: 'raw',   name: 'Raw',    desc: 'No cleanup',                        dot: FL.ink4 },
  ];
  const custom = [
    { id: 'standup', name: 'Standup notes', desc: 'Bullet list with names bolded', dot: '#7AB8B0' },
    { id: 'commit',  name: 'Commit msg',    desc: 'Imperative, ≤72 chars', dot: '#C9A35E' },
  ];

  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderRight: `0.5px solid ${FL.hair}`,
      background: FL.sidebarBg,
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <GroupLabel>Built-in</GroupLabel>
      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {built.map((p) => <ProfileRow key={p.id} item={p} />)}
      </div>
      <GroupLabel>Custom</GroupLabel>
      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {custom.map((p) => <ProfileRow key={p.id} item={p} />)}
        <button style={{
          margin: '6px 0 0',
          padding: '6px 8px',
          background: 'transparent', border: 0, color: FL.ink3,
          fontFamily: FL.sf, fontSize: 12, textAlign: 'left',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', borderRadius: 5,
        }}>
          <IconPlus size={12} color={FL.ink3} strokeWidth={1.7} />
          New profile
        </button>
      </div>
    </div>
  );
}

function ProfileRow({ item }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 8px',
      borderRadius: 5,
      background: item.active ? FL.selection : 'transparent',
      cursor: 'pointer',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: item.dot, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: item.active ? 500 : 400, color: FL.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.name}
          {item.active && <Tag tone="amber">Active</Tag>}
        </div>
        <div style={{ fontSize: 11, color: FL.ink3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.desc}
        </div>
        {item.badge && (
          <div style={{ fontSize: 10, color: FL.ink3, fontFamily: FL.mono, marginTop: 3, letterSpacing: 0.3 }}>
            {item.badge}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileEditor() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: `0.5px solid ${FL.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: FL.amber, flexShrink: 0 }} />
          <h2 style={{
            margin: 0, fontFamily: FL.sfDisplay, fontSize: 22, fontWeight: 600,
            color: FL.ink, letterSpacing: -0.4,
          }}>Email</h2>
          <Tag tone="amber">Active in Mail</Tag>
          <span style={{ flex: 1 }} />
          <Btn kind="plain" size="sm" icon={<IconPencil size={12} />}>Rename</Btn>
          <Btn kind="plain" size="sm" icon={<IconCopy size={12} />}>Duplicate</Btn>
        </div>
      </div>

      {/* form */}
      <div style={{ padding: '20px 28px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <FormRow label="Description" hint="Shown in the recording overlay picker.">
          <Field value="Sentence case, polite, em-dashes preserved." />
        </FormRow>

        <FormRow label="Style instructions" hint="Sent to the local model after Whisper transcribes. Markdown supported.">
          <Field
            multiline rows={6}
            value={`Format the output as a polished email body.
- Sentence case, normal punctuation.
- Prefer em-dashes (—) over double-hyphens.
- Keep the speaker's voice — don't add filler.
- Recognize names from the vocabulary list.`}
          />
        </FormRow>

        <FormRow label="Apply when in" hint="Profile follows the foreground app. Falls back to Default.">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <AppChip id="mail" name="Mail" />
            <AppChip id="safari" name="Spark" />
            <AppChip id="messages" name="Superhuman" />
            <button style={{
              border: `0.5px dashed ${FL.hairStrong}`, background: 'transparent',
              color: FL.ink2, fontFamily: FL.sf, fontSize: 12, fontWeight: 400,
              padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <IconPlus size={11} color={FL.ink2} strokeWidth={1.7} />
              Add app
            </button>
          </div>
        </FormRow>

        <FormRow label="Model" hint="A smaller model is faster. Cleanup latency is shown live in History.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Segmented
              options={[
                { value: 'l32', label: 'llama 3.2 · 1B' },
                { value: 'l31', label: 'llama 3.1 · 3B' },
                { value: 'mistral', label: 'mistral · 7B' },
              ]}
              value="l32"
            />
            <span style={{ fontSize: 11, color: FL.ink3, fontFamily: FL.mono }}>~1.0s on M2</span>
          </div>
        </FormRow>
      </div>

      <Divider />

      {/* live preview */}
      <div style={{ padding: '20px 28px 28px' }}>
        <GroupLabel style={{ padding: '0 0 8px' }}>Live preview</GroupLabel>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 0,
          alignItems: 'stretch',
        }}>
          <div style={{
            padding: 14, borderRadius: FL.rCard, background: FL.fill,
            fontFamily: FL.mono, fontSize: 12, color: FL.ink2, lineHeight: 1.55,
          }}>
            <div style={{ fontFamily: FL.sf, fontSize: 10, color: FL.ink3, fontWeight: 590, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 }}>
              Sample raw
            </div>
            hey sam can we move the design review to thursday afternoon i want to make sure we have time to walk through the recording overlay variants together
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: FL.amberInk }}>→</div>
          <div style={{
            padding: 14, borderRadius: FL.rCard,
            background: '#FFFFFF', border: `0.5px solid ${FL.hair}`,
            fontSize: 13.5, color: FL.ink, lineHeight: 1.55,
          }}>
            <div style={{ fontFamily: FL.sf, fontSize: 10, color: FL.amberInk, fontWeight: 590, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconSparkle size={10} color={FL.amberInk} /> Cleaned
            </div>
            Hey Sam — could we move the design review to Thursday afternoon? I want to make sure we have time to walk through the recording overlay variants together.
          </div>
        </div>
      </div>

      {/* footer save bar */}
      <div style={{
        marginTop: 'auto', padding: '10px 28px',
        borderTop: `0.5px solid ${FL.hair}`,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(250,250,247,0.86)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', bottom: 0,
      }}>
        <span style={{ fontSize: 11, color: FL.ink3, fontFamily: FL.mono }}>autosaves on every keystroke</span>
        <span style={{ flex: 1 }} />
        <Btn kind="danger" size="sm">Reset to default</Btn>
        <Btn kind="primary" size="sm">Test with last clip ⌘T</Btn>
      </div>
    </div>
  );
}

function FormRow({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: FL.ink }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: FL.ink3, marginTop: 2, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function AppChip({ id, name }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 4px 3px 4px', paddingRight: 8,
      background: '#FFFFFF', border: `0.5px solid ${FL.hairStrong}`,
      borderRadius: 5, fontSize: 12, color: FL.ink,
    }}>
      <AppGlyph id={id} size={14} />
      {name}
      <button style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', color: FL.ink3, marginLeft: 2 }}>
        <IconX size={10} strokeWidth={1.8} />
      </button>
    </span>
  );
}

Object.assign(window, { ProfilesScreen });
