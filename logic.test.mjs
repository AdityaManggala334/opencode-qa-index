import assert from "node:assert/strict"
import test from "node:test"
import { clip, clock, entriesOf, flat, mergeMessages, numberOption, stateOf } from "./logic.js"

const user = (id, text, extra = {}) => ({ id, type: "user", text, time: { created: 10 }, ...extra })
const assistant = (id, content = [{ type: "text", text: "ok" }], extra = {}) => ({
  id,
  type: "assistant",
  content,
  time: { created: 20, completed: 25 },
  ...extra,
})
const tool = (status) => ({ type: "tool", name: "bash", state: { status } })

test("flat and clip", () => {
  assert.equal(flat("  hello\n\nworld "), "hello world")
  assert.equal(flat(undefined), "")
  assert.equal(clip("abcdef", 4), "abc…")
  assert.equal(clip("abc", 4), "abc")
  assert.equal(clip("a😀b", 2), "a…")
})

test("clock prints a bracketed local time and nothing for a missing stamp", () => {
  assert.equal(clock(new Date(2026, 10, 5, 9, 3).getTime()), "[09.03]")
  assert.equal(clock(new Date(2026, 10, 5, 0, 5).getTime()), "[00.05]")
  assert.equal(clock(new Date(2026, 10, 5, 23, 59).getTime()), "[23.59]")
  assert.equal(clock(0), "")
  assert.equal(clock(undefined), "")
})

test("numberOption accepts numbers and numeric strings, rejects the rest", () => {
  assert.equal(numberOption(8, 12), 8)
  assert.equal(numberOption("20", 12), 20)
  assert.equal(numberOption(" ", 12), 12)
  assert.equal(numberOption(undefined, 12), 12)
  assert.equal(numberOption(0, 12), 12)
  assert.equal(numberOption(-3, 12), 12)
  assert.equal(numberOption(7.9, 12), 7)
})

test("status: pending approval wins over everything", () => {
  assert.equal(stateOf([assistant("a1")], true), "?")
  assert.equal(stateOf([assistant("a1", undefined, { time: { created: 1 } })], true), "?")
})

test("status: running, error, changed files, done", () => {
  assert.equal(stateOf([assistant("a1", undefined, { time: { created: 1 } })]), "⋯")
  assert.equal(stateOf([assistant("a1", undefined, { finish: "error" })]), "✗")
  assert.equal(stateOf([assistant("a1", [tool("error"), { type: "text", text: "ok" }])]), "✗")
  assert.equal(stateOf([assistant("a1", undefined, { snapshot: { files: ["src/a.ts"] } })]), "±")
  assert.equal(stateOf([assistant("a1")]), "✓")
})

test("status: truncation and empty turns have no symbol", () => {
  assert.equal(stateOf([assistant("a1", undefined, { finish: "length" })]), "✓")
  assert.equal(stateOf([assistant("a1", [])]), undefined)
  assert.equal(stateOf([]), undefined)
  assert.equal(stateOf([assistant("a1", [tool("completed")])]), undefined)
})

test("entries: numbering, skipped blank prompts, compaction rows", () => {
  const entries = entriesOf([
    user("u1", "pertama"),
    assistant("a1"),
    user("u2", "kedua"),
    assistant("a2", undefined, { time: { created: 30 } }),
    { id: "c1", type: "compaction", status: "completed", reason: "auto", summary: "ringkasan sesi" },
    user("u3", "   "),
    user("u4", "ketiga"),
    assistant("a4", undefined, { finish: "error" }),
    { id: "c2", type: "compaction", status: "failed", reason: "auto", summary: "gagal" },
  ])

  assert.deepEqual(
    entries.map((entry) =>
      entry.kind === "summary"
        ? ["summary", entry.title, entry.summary]
        : ["turn", entry.index, entry.id, entry.state],
    ),
    [
      ["turn", 1, "u1", "✓"],
      ["turn", 2, "u2", "⋯"],
      ["summary", "summary", "ringkasan sesi"],
      ["turn", 3, "u4", "✗"],
    ],
  )
})

test("entries: the compaction row label comes from the language option", () => {
  const messages = [{ id: "c1", type: "compaction", status: "completed", summary: "s" }]
  assert.equal(entriesOf(messages)[0].title, "summary")
  assert.equal(entriesOf(messages, false, "ringkasan")[0].title, "ringkasan")
})

test("entries: pending approval only decorates the newest turn", () => {
  const entries = entriesOf([user("u1", "a"), assistant("a1"), user("u2", "b"), assistant("a2")], true)
  assert.deepEqual(
    entries.map((entry) => entry.state),
    ["✓", "?"],
  )
})

test("entries: agent comes from the answer, else the last switch", () => {
  const entries = entriesOf([
    user("u1", "a"),
    assistant("a1", undefined, { agent: "plan" }),
    { id: "s1", type: "agent-switched", agent: "build", time: { created: 5 } },
    user("u2", "b"),
    assistant("a2", undefined, { agent: "build" }),
    user("u3", "c"),
  ])
  assert.deepEqual(
    entries.map((entry) => entry.agent),
    ["plan", "build", "build"],
  )
})

test("merge: cache wins per id and order follows creation time", () => {
  const old = user("u1", "lama")
  const done = assistant("a1")
  const streaming = { ...done, time: { created: 20 } }
  const fresh = user("u2", "baru", { time: { created: 30 } })

  const merged = mergeMessages([old, done], [streaming, fresh])
  assert.deepEqual(
    merged.map((message) => message.id),
    ["u1", "a1", "u2"],
  )
  assert.equal(merged[1].time.completed, undefined)
  assert.deepEqual(mergeMessages([], []), [])
  assert.deepEqual(
    mergeMessages([old], [old]).map((message) => message.id),
    ["u1"],
  )
})

test("entries: messages before any prompt are ignored", () => {
  const entries = entriesOf([assistant("a0"), { id: "c0", type: "compaction", status: "completed", summary: "s" }])
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ["summary"],
  )
})

test("entries: the last assistant decides a running turn", () => {
  const entries = entriesOf([
    user("u1", "a"),
    assistant("a1"),
    { ...assistant("a2"), time: { created: 30 } },
  ])
  assert.equal(entries[0].state, "⋯")
})

test("entries: reasoning-only answers show no symbol", () => {
  const entries = entriesOf([user("u1", "a"), assistant("a1", [{ type: "reasoning", text: "thinking" }])])
  assert.equal(entries[0].state, undefined)
})

test("entries: consecutive compactions keep their order", () => {
  const entries = entriesOf([
    user("u1", "a"),
    assistant("a1"),
    { id: "c1", type: "compaction", status: "completed", summary: "satu" },
    { id: "c2", type: "compaction", status: "running", summary: "dua" },
  ])
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ["turn", "summary", "summary"],
  )
})
