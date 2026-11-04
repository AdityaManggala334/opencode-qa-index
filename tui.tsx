/** @jsxImportSource @opentui/solid */
import { createEffect, createSignal, For, onMount, Show } from "solid-js"
import { clip, clock, entriesOf, flat, mergeMessages, numberOption } from "./logic.js"
import { fetchAllMessages } from "./history.js"
import { texts } from "./strings.js"

// Sidebar index of a session's turns: the prompt is text, the answer is one
// status glyph at the right edge. Clicking either scrolls the transcript there.
//
// OpenCode has no public scrollToMessage API, so the jump reuses the built-in
// navigation commands (session.messages_last_user, session.message.user.previous,
// session.message.next). They use the same anchors as /timeline.
// shortcut: jumps step one message at a time and only reach rows the transcript
// has mounted; swap to scrollToMessage if OpenCode publishes one.
const RETRIES = 3 // the first fetch can land before the client is connected
const RETRY_MS = 1200
const LABEL = 4 // fixed Qn column, so every [HH.MM] starts on the same column
const STEP = 40 // ms between keystroke-sized jumps, so each scroll lands first

const MARK = {
  "?": (theme) => theme.text.feedback.warning.base,
  "⋯": (theme) => theme.text.muted,
  "✗": (theme) => theme.text.feedback.error.base,
  "±": (theme) => theme.text.action.primary.base,
  "✓": (theme) => theme.text.feedback.success.base,
  "≡": (theme) => theme.text.muted,
}

function jump(ctx, sessionID, target, answer) {
  const users = (ctx.data.session.message.list(sessionID) ?? []).filter(
    (message) => message?.type === "user" && flat(message.text),
  )
  const index = users.findIndex((message) => message.id === target)
  if (index < 0) return

  // Anchor at the newest question, then step back to the target.
  let steps = users.length - 1 - index
  ctx.keymap.dispatch("session.messages_last_user")

  const step = () => {
    if (steps > 0) {
      steps--
      ctx.keymap.dispatch("session.message.user.previous")
      setTimeout(step, STEP)
      return
    }
    if (answer) setTimeout(() => ctx.keymap.dispatch("session.message.next"), STEP)
  }
  setTimeout(step, STEP)
}

const click = (run) => (event) => {
  if (event?.type !== "up" || event?.button !== 0) return
  event.preventDefault?.()
  event.stopPropagation?.()
  run()
}

function Panel(props) {
  const ctx = props.ctx
  const theme = ctx.theme
  const strings = texts(typeof ctx.options?.language === "string" ? ctx.options.language : undefined)
  const rows = numberOption(ctx.options?.rows, 12)
  const pageSize = numberOption(ctx.options?.pageSize, 200)
  const maxPages = numberOption(ctx.options?.maxPages, 50)
  const titleLength = numberOption(ctx.options?.titleLength, 18)
  const planColor = typeof ctx.options?.planColor === "string" ? ctx.options.planColor : theme.text.feedback.warning.base
  const buildColor =
    typeof ctx.options?.buildColor === "string"
      ? ctx.options.buildColor
      : theme.decrease(theme.text.feedback.info.base, 0.8)

  const [open, setOpen] = ctx.storage.store("qa-index", { initial: { open: true } })
  const [history, setHistory] = createSignal([])
  const toggle = () =>
    setOpen((draft) => (draft.open = !draft.open)).catch((error) =>
      console.error("Failed to persist qa-index state", error),
    )

  // The TUI cache holds only the newest page, so older turns are fetched here.
  // On startup the client may not be connected yet, so an empty load retries.
  let loading = false
  const loadHistory = async (attempt = 0) => {
    if (loading) return
    loading = true
    let all = []
    try {
      all = await fetchAllMessages(ctx.client, props.sessionID, { limit: pageSize, pages: maxPages })
    } finally {
      loading = false
    }
    if (all.length > 0) return setHistory(all)
    if (attempt < RETRIES) setTimeout(() => loadHistory(attempt + 1), RETRY_MS)
  }

  onMount(() => {
    Promise.resolve(ctx.data.session.message.sync(props.sessionID)).catch(() => {})
    Promise.resolve(ctx.data.session.permission.sync(props.sessionID)).catch(() => {})
    Promise.resolve(ctx.data.location.agent.sync(ctx.location)).catch(() => {})
    loadHistory().catch((error) => console.error("qa-index history load failed", error))
  })

  // If the first fetch landed too early, the next message event tries again.
  createEffect(() => {
    if (props.version() > 0 && history().length === 0) loadHistory()
  })

  const pending = () => (ctx.data.session.permission.list(props.sessionID) ?? []).length > 0
  // Mirrors the host's agent accent (local.agent.color): the agent's own color,
  // else its slot in the theme's categorical palette.
  const agentColor = (agent) => {
    if (agent === "plan") return planColor
    if (agent === "build") return buildColor
    const agents = (ctx.data.location.agent.list(ctx.location) ?? []).filter((item) => !item.hidden)
    const index = agents.findIndex((item) => item.id === agent)
    if (index === -1) return theme.text.muted
    if (agents[index].color) return agents[index].color
    const scale = theme.categorical[index % theme.categorical.length]
    return scale?.[200] ?? theme.text.muted
  }
  const entries = () => {
    props.version()
    return entriesOf(mergeMessages(history(), ctx.data.session.message.list(props.sessionID) ?? []), pending())
  }

  const showSummary = (entry) => {
    ctx.ui.dialog.set({ size: "large" })
    ctx.ui.dialog.show(() => (
      <box flexDirection="column" height="100%" padding={1} gap={1}>
        <text fg={theme.text.base}>
          <b>{strings.summaryTitle}</b>
        </text>
        <scrollbox flexGrow={1} minHeight={0}>
          <text fg={theme.text.base} wrapMode="word">
            {entry.summary || strings.summaryEmpty}
          </text>
        </scrollbox>
      </box>
    ))
  }

  const pick = async () => {
    const turns = entries().filter((entry) => entry.kind === "turn")
    const chosen = await ctx.ui.dialog.select({
      title: strings.pickerTitle,
      placeholder: strings.pickerPlaceholder,
      options: turns
        .slice()
        .reverse()
        .map((turn) => ({ title: turn.title, value: turn.id, description: `Q${turn.index}` })),
    })
    if (chosen) jump(ctx, props.sessionID, chosen, false)
  }

  const row = (entry) =>
    entry.kind === "summary" ? (
      <box flexDirection="row" gap={1} minWidth={0} onMouseUp={click(() => showSummary(entry))}>
        <box width={LABEL} flexShrink={0} flexDirection="row" justifyContent="center">
          <text fg={theme.text.muted}>≡</text>
        </box>
        <text fg={theme.text.muted} flexShrink={0}>
          {clock(entry.created)}
        </text>
        <text fg={theme.text.muted} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}>
          {entry.title}
        </text>
      </box>
    ) : (
      <box flexDirection="row" gap={1} minWidth={0} onMouseUp={click(() => jump(ctx, props.sessionID, entry.id, false))}>
        <box width={LABEL} flexShrink={0} flexDirection="row" justifyContent="center">
          <text fg={agentColor(entry.agent)}>{`Q${entry.index}`}</text>
        </box>
        <text fg={theme.text.muted} flexShrink={0}>
          {clock(entry.created)}
        </text>
        <text fg={theme.text.base} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}>
          {clip(entry.title, titleLength)}
        </text>
        <Show when={entry.state}>
          <box flexShrink={0} onMouseUp={click(() => jump(ctx, props.sessionID, entry.id, true))}>
            <text fg={MARK[entry.state](theme)}>{entry.state}</text>
          </box>
        </Show>
      </box>
    )

  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={1} onMouseUp={click(toggle)}>
        <text fg={theme.text.base}>{open.open ? "▼" : "▶"}</text>
        <text fg={theme.text.base}>
          <b>{strings.title}</b>
          <span style={{ fg: theme.text.muted }}>{` (${entries().filter((entry) => entry.kind === "turn").length})`}</span>
        </text>
      </box>
      <Show when={open.open}>
        <Show
          when={entries().length > 0}
          fallback={
            <text fg={theme.text.muted} wrapMode="word">
              {strings.empty}
            </text>
          }
        >
          <box flexDirection="column" paddingLeft={1} paddingRight={1}>
            <scrollbox height={rows} minHeight={0} verticalScrollbarOptions={{ visible: false }}>
              <For each={entries()}>{(entry) => row(entry)}</For>
            </scrollbox>
            <text fg={theme.text.muted} onMouseUp={click(pick)}>
              {strings.search}
            </text>
          </box>
        </Show>
      </Show>
    </box>
  )
}

export default {
  id: "qa-index",
  setup(ctx) {
    // One shared counter: events arrive in bursts while streaming, so the
    // sidebar repaints at most every 150ms.
    const [version, setVersion] = createSignal(0)
    let pending

    const off = ctx.data.listen((event) => {
      const details = event?.details ?? event
      const type = details?.type
      if (!type?.startsWith("session.message") && !type?.startsWith("session.execution") && !type?.startsWith("permission."))
        return
      if (pending) return
      pending = setTimeout(() => {
        pending = undefined
        setVersion((value) => value + 1)
      }, 150)
    })

    ctx.ui.slot({
      append: "sidebar.content",
      render: (props) => <Panel ctx={ctx} sessionID={props.sessionID} version={version} />,
    })

    return () => {
      clearTimeout(pending)
      off?.()
    }
  },
}
