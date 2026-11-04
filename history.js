// Full-history fetch for the sidebar. The TUI cache only holds the newest page,
// so older turns are paged in here. The client is injected to keep this testable.

const items = (response) => {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.data)) return response.data.data
  return []
}

const nextCursor = (response) => response?.cursor?.next ?? response?.data?.cursor?.next

export async function fetchAllMessages(client, sessionID, options = {}) {
  const limit = options.limit ?? 200
  const maxPages = options.pages ?? 50
  const all = []
  let cursor

  try {
    for (let page = 0; page < maxPages; page++) {
      // A cursor carries its own direction; sending order with it is rejected.
      const input = cursor ? { sessionID, limit, cursor } : { sessionID, limit, order: "asc" }
      const response = await client.message.list(input)
      all.push(...items(response))
      cursor = nextCursor(response)
      if (!cursor) break
    }
  } catch {
    return []
  }

  return all
}
