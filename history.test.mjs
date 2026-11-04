import assert from "node:assert/strict"
import test from "node:test"
import { fetchAllMessages } from "./history.js"

const message = (id) => ({ id, type: "user", text: id, time: { created: 1 } })

test("one page without a next cursor", async () => {
  const calls = []
  const client = {
    message: {
      list: async (input) => {
        calls.push(input)
        return { data: [message("a"), message("b")], cursor: { next: null } }
      },
    },
  }
  const all = await fetchAllMessages(client, "ses_1")
  assert.deepEqual(
    all.map((item) => item.id),
    ["a", "b"],
  )
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { sessionID: "ses_1", limit: 200, order: "asc" })
})

test("pages forward, and never combines cursor with order", async () => {
  const calls = []
  const pages = [
    { data: [message("a")], cursor: { next: "c1" } },
    { data: [message("b")], cursor: { next: "c2" } },
    { data: [message("c")], cursor: { next: null } },
  ]
  const client = {
    message: {
      list: async (input) => {
        if (input.cursor && input.order) throw new Error("Cursor cannot be combined with order")
        calls.push(input)
        return pages.shift()
      },
    },
  }

  const all = await fetchAllMessages(client, "ses_1", { limit: 100 })
  assert.deepEqual(
    all.map((item) => item.id),
    ["a", "b", "c"],
  )
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[0], { sessionID: "ses_1", limit: 100, order: "asc" })
  assert.deepEqual(calls[1], { sessionID: "ses_1", limit: 100, cursor: "c1" })
  assert.deepEqual(calls[2], { sessionID: "ses_1", limit: 100, cursor: "c2" })
})

test("stops at the page cap even if the server keeps paginating", async () => {
  let calls = 0
  const client = {
    message: {
      list: async () => {
        calls++
        return { data: [message(`m${calls}`)], cursor: { next: "more" } }
      },
    },
  }
  const all = await fetchAllMessages(client, "ses_1", { pages: 3 })
  assert.equal(calls, 3)
  assert.equal(all.length, 3)
})

test("returns an empty list when the client throws", async () => {
  const client = {
    message: {
      list: async () => {
        throw new Error("not connected")
      },
    },
  }
  assert.deepEqual(await fetchAllMessages(client, "ses_1"), [])
})

test("reads every response envelope shape", async () => {
  for (const response of [
    [message("a")],
    { data: [message("a")] },
    { data: { data: [message("a")] } },
    {},
  ]) {
    const client = { message: { list: async () => response } }
    const all = await fetchAllMessages(client, "ses_1")
    assert.equal(all.length, Array.isArray(response) || response.data ? 1 : 0)
  }
})
