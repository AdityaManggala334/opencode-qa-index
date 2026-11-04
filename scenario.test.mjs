// End-to-end model test: a fake server with two pages, a live cache holding a
// streaming answer, and the sidebar entries a user would actually see.
import assert from "node:assert/strict"
import test from "node:test"
import { fetchAllMessages } from "./history.js"
import { clock, entriesOf, mergeMessages } from "./logic.js"

const user = (id, text, created) => ({ id, type: "user", text, time: { created } })
const assistant = (id, created, extra = {}) => ({
  id,
  type: "assistant",
  content: [{ type: "text", text: "jawaban" }],
  time: { created, completed: created + 1 },
  ...extra,
})

const pageOne = [
  user("u1", "pertanyaan pertama", 1000),
  assistant("a1", 1100, { agent: "plan", finish: "stop" }),
  { id: "s1", type: "agent-switched", agent: "build", time: { created: 1150 } },
  user("u2", "kedua", 2000),
  assistant("a2", 2100, { agent: "build", snapshot: { files: ["src/a.ts"] } }),
]
const pageTwo = [
  { id: "c1", type: "compaction", status: "completed", reason: "auto", summary: "ringkasan sesi", time: { created: 3000 } },
  user("u3", "ketiga", 4000),
  assistant("a3", 4100, { agent: "build", finish: "error" }),
  user("u4", "keempat", 5000),
]

function server() {
  const calls = []
  const pages = [
    { data: pageOne, cursor: { next: "c1" } },
    { data: pageTwo, cursor: { next: null } },
  ]
  return {
    calls,
    message: {
      list: async (input) => {
        if (input.cursor && input.order) throw new Error("Cursor cannot be combined with order")
        calls.push(input)
        return pages.shift()
      },
    },
  }
}

// The live cache keeps the newest page plus an answer still streaming in.
const cache = [...pageTwo, assistant("a4", 5100, { agent: "build", time: { created: 5100 } })]

test("scenario: full history loads without scrolling the transcript", async () => {
  const client = server()
  const history = await fetchAllMessages(client, "ses_demo", { limit: 100 })

  assert.equal(client.calls.length, 2)
  assert.deepEqual(client.calls[1], { sessionID: "ses_demo", limit: 100, cursor: "c1" })
  assert.equal(history.length, pageOne.length + pageTwo.length)
})

test("scenario: sidebar shows Q1..Q4 with time, agent and status", async () => {
  const history = await fetchAllMessages(server(), "ses_demo", { limit: 100 })
  const entries = entriesOf(mergeMessages(history, cache))

  assert.deepEqual(
    entries.map((entry) =>
      entry.kind === "summary" ? ["summary", entry.title] : [`Q${entry.index}`, entry.state, entry.agent],
    ),
    [["Q1", "✓", "plan"], ["Q2", "±", "build"], ["summary", "ringkasan"], ["Q3", "✗", "build"], ["Q4", "⋯", "build"]],
  )

  for (const entry of entries) assert.match(clock(entry.created), /^\[\d{2}\.\d{2}\]$/)
})

test("scenario: a pending approval marks only the newest turn", async () => {
  const history = await fetchAllMessages(server(), "ses_demo", { limit: 100 })
  const entries = entriesOf(mergeMessages(history, cache), true)

  assert.deepEqual(
    entries.map((entry) => (entry.kind === "summary" ? "≡" : entry.state)),
    ["✓", "±", "≡", "✗", "?"],
  )
})

test("scenario: answers stream in from the cache without refetching", async () => {
  const history = await fetchAllMessages(server(), "ses_demo", { limit: 100 })
  const finished = [...cache.slice(0, -1), assistant("a4", 5100, { agent: "build" })]

  const entries = entriesOf(mergeMessages(history, finished))
  assert.equal(entries.at(-1).state, "✓")
})
