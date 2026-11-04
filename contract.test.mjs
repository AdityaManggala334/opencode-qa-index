import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const dir = dirname(fileURLToPath(import.meta.url))
const read = (name) => readFileSync(join(dir, name), "utf8")
const pkg = JSON.parse(read("package.json"))

test("package declares the TUI and server entrypoints", () => {
  assert.equal(pkg.exports["."], "./index.ts")
  assert.equal(pkg.exports["./tui"], "./tui.tsx")
  assert.equal(pkg.type, "module")
})

test("every entrypoint exists on disk", () => {
  for (const file of ["./index.ts", "./tui.tsx", "./logic.js", "./history.js"]) {
    assert.ok(existsSync(join(dir, file)), `${file} missing`)
  }
})

test("both halves use the same plugin id", () => {
  assert.match(read("index.ts"), /id:\s*"qa-index"/)
  assert.match(read("tui.tsx"), /id:\s*"qa-index"/)
})

test("history fetch uses the flat client method, not the old session path", () => {
  const source = read("history.js")
  assert.match(source, /client\.message\.list/)
  assert.doesNotMatch(source, /client\.session\.message/)
})

test("the panel never imports the temporary debug channel", () => {
  assert.doesNotMatch(read("tui.tsx"), /debug\.js/)
  assert.ok(!existsSync(join(dir, "debug.js")), "debug.js should stay deleted")
})
