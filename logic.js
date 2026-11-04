// Pure sidebar model for qa-index: one entry per user message (with the status
// of its answer) plus one entry per session compaction.

export const flat = (value) => (value ?? "").replace(/\s+/g, " ").trim()

export const clip = (value, max) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`)

// cli.json options arrive as unknown JSON; anything unusable falls back.
export const numberOption = (value, fallback, min = 1) => {
  const parsed = typeof value === "string" ? Number(value) : value
  return Number.isFinite(parsed) && parsed >= min ? Math.trunc(parsed) : fallback
}

// [09.30] — the brackets are the column separator, so no extra bar is drawn.
export const clock = (created) => {
  if (!Number.isFinite(created) || created <= 0) return ""
  const at = new Date(created)
  const pad = (value) => String(value).padStart(2, "0")
  return `[${pad(at.getHours())}.${pad(at.getMinutes())}]`
}

const partsOf = (message) => message?.content ?? message?.parts ?? []

const isText = (part) => part?.type === "text" && flat(part.text)

// Older messages come from the session API, newer ones from the live cache.
// The cache wins per id so a streaming message shows its latest state.
export function mergeMessages(history, cache) {
  const byId = new Map()
  for (const message of history ?? []) byId.set(message.id, message)
  for (const message of cache ?? []) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => (a.time?.created ?? 0) - (b.time?.created ?? 0))
}

/**
 * Answer status of one turn, most urgent first:
 * ? waiting for approval, ⋯ still running, ✗ failed, ± changed files, ✓ done.
 */
export function stateOf(assistants, pendingPermission = false) {
  if (pendingPermission) return "?"
  const last = assistants.at(-1)
  if (!last) return undefined
  if (!last.time?.completed) return "⋯"
  if (last.finish === "error") return "✗"
  if (assistants.some((message) => partsOf(message).some((part) => part?.type === "tool" && part.state?.status === "error")))
    return "✗"
  if (assistants.some((message) => (message.snapshot?.files?.length ?? 0) > 0)) return "±"
  if (assistants.some((message) => partsOf(message).some(isText))) return "✓"
  return undefined
}

export function entriesOf(messages, pendingPermission = false, summaryRow = "summary") {
  const raw = []
  let turn = undefined
  let agent = undefined

  for (const message of messages ?? []) {
    if (message?.type === "agent-switched") {
      agent = message.agent
      continue
    }
    if (message?.type === "user") {
      const title = flat(message.text)
      turn = title
        ? { kind: "turn", id: message.id, title, created: message.time?.created ?? 0, assistants: [], agent }
        : undefined
      if (turn) raw.push(turn)
      continue
    }
    if (message?.type === "assistant") {
      turn?.assistants.push(message)
      continue
    }
    if (message?.type === "compaction" && message.status !== "failed") {
      turn = undefined
      raw.push({
        kind: "summary",
        id: message.id,
        title: summaryRow,
        created: message.time?.created ?? 0,
        summary: message.summary ?? "",
      })
    }
  }

  const lastTurn = raw.findLastIndex((entry) => entry.kind === "turn")
  let count = 0
  return raw.map((entry, position) => {
    if (entry.kind === "summary") return entry
    count++
    return {
      kind: "turn",
      index: count,
      id: entry.id,
      title: entry.title,
      created: entry.created,
      agent: entry.assistants.at(-1)?.agent ?? entry.agent,
      state: stateOf(entry.assistants, pendingPermission && position === lastTurn),
    }
  })
}
