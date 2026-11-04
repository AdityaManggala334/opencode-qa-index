// Server half: the index is TUI-only, so the definition is empty — but it must be
// Plugin.define, not a plain object: the server loader rejects the latter and then
// never loads ./tui either.
import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "qa-index",
  setup() {},
})
