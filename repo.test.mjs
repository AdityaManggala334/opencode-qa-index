// Checks the repository as shipped, not just the code: what npm would publish,
// what the README promises, and what must never leak into a public repo.
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const dir = dirname(fileURLToPath(import.meta.url))
const read = (name) => readFileSync(join(dir, name), "utf8")
const pkg = JSON.parse(read("package.json"))

const files = (root = dir) =>
  readdirSync(root).flatMap((name) => {
    if (name === ".git" || name === "node_modules") return []
    const path = join(root, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

test("package metadata is publishable", () => {
  assert.match(pkg.name, /^[a-z0-9][a-z0-9._-]*$/)
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.type, "module")
  assert.ok(pkg.description.length > 20)
  assert.ok(pkg.keywords.includes("opencode"))
  assert.equal(pkg.scripts.test, "node --test")
  // The host renders with its own OpenTUI runtime, so those stay peers — but they
  // must install with the package, because a package install resolves imports from
  // its own tree, not the TUI's. The plugin API is a real dependency for the same
  // reason: the server half imports it.
  assert.ok(pkg.peerDependencies["solid-js"])
  assert.ok(pkg.peerDependencies["@opentui/solid"])
  assert.equal(pkg.peerDependenciesMeta, undefined, "peers must not be optional")
  assert.ok(pkg.dependencies["@opencode/plugin"])
  assert.equal(pkg.peerDependencies["@opencode/plugin"], undefined)
  assert.deepEqual(Object.keys(pkg.dependencies), ["@opencode/plugin"], "no other runtime dependencies")
  assert.match(pkg.repository.url, /opencode-qa-index\.git$/)
})

test("every file listed in package.json exists", () => {
  for (const file of pkg.files) {
    assert.ok(statSync(join(dir, file)).isFile(), `${file} missing`)
  }
})

test("npm pack ships only runtime files", () => {
  let output
  try {
    output = execSync("npm pack --dry-run --json --ignore-scripts", { cwd: dir, encoding: "utf8" })
  } catch {
    return // npm unavailable (e.g. offline runner); the file list test still runs
  }
  // npm <11 prints [entry]; npm >=11 prints { "<name>": entry }.
  const packed = JSON.parse(output)
  const entry = Array.isArray(packed) ? packed[0] : packed[pkg.name] ?? Object.values(packed)[0]
  const shipped = entry.files.map((item) => item.path).sort()
  assert.deepEqual(shipped, [
    "LICENSE",
    "README.md",
    "history.js",
    "index.ts",
    "logic.js",
    "package.json",
    "strings.js",
    "tui.tsx",
  ])
})

test("tests, workflow and local debug files never ship", () => {
  assert.ok(pkg.files.every((file) => !file.endsWith(".test.mjs")))
  assert.ok(pkg.files.every((file) => !file.startsWith(".github")))
  assert.ok(!pkg.files.includes("debug.js"))
  assert.ok(!pkg.files.includes("debug.log"))
})

test("README documents every option and every glyph", () => {
  const readme = read("README.md")
  for (const option of ["language", "rows", "pageSize", "maxPages", "titleLength", "planColor", "buildColor"]) {
    assert.ok(readme.includes(`\`${option}\``), `README misses ${option}`)
  }
  for (const glyph of ["?", "⋯", "✗", "±", "✓", "≡"]) {
    assert.ok(readme.includes(`\`${glyph}\``), `README misses ${glyph}`)
  }
  assert.ok(readme.includes("MIT"))
})

test("relative imports resolve to real files", () => {
  for (const file of files()) {
    if (!/\.(m?js|tsx?)$/.test(file)) continue
    const source = readFileSync(file, "utf8")
    for (const [, target] of source.matchAll(/from\s+"(\.\.?\/[^"]+)"/g)) {
      assert.ok(statSync(join(dirname(file), target), { throwIfNoEntry: false }), `${relative(dir, file)} imports missing ${target}`)
    }
  }
})

test("no secrets or developer paths leak into the repo", () => {
  const forbidden = [
    /nsk_[A-Za-z0-9]{8,}/, // provider API keys used while building this
    /g9oA9-[A-Za-z0-9_-]{8,}/, // local service password
    /C:\\\\?Users\\\\?/i,
    /ghp_[A-Za-z0-9]{20,}/,
    /sk-[A-Za-z0-9]{20,}/,
  ]
  const ignore = [/^\.env$/i, /credentials/i, /\.log$/]
  for (const file of files()) {
    const name = relative(dir, file)
    if (ignore.some((pattern) => pattern.test(name))) continue
    const source = readFileSync(file, "utf8")
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${name} matches ${pattern}`)
    }
  }
})

test(".gitignore keeps build and debug output out of git", () => {
  const ignore = read(".gitignore")
  for (const entry of ["node_modules", "debug.log", "*.tgz"]) {
    assert.ok(ignore.includes(entry), `.gitignore misses ${entry}`)
  }
})

test("CI runs the test suite", () => {
  const workflow = read(".github/workflows/test.yml")
  assert.match(workflow, /node --test/)
  assert.match(workflow, /^on:/m)
})

test("LICENSE is MIT", () => {
  assert.match(read("LICENSE"), /^MIT License/)
  assert.match(read("LICENSE"), /Copyright \(c\) \d{4}/)
})
