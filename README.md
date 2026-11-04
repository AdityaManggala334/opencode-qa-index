# opencode-qa-index

A sidebar index of every prompt in an [OpenCode](https://opencode.ai) V2 session.
Each row is one turn: the question, when you asked it, which agent answered, and
the status of the answer. Click the question to jump to it in the transcript, or
click the status glyph to jump to the beginning of its answer.

```
▼ History (19)
 Q1  [09.30] configure the settings so that…   ✓
 Q2  [09.41] is OpenCode an option…            ±
   ≡ [09.52] summary
 Q3  [10.02] refactor auth…                    ⋯
search…
```

## Status glyphs

| Glyph | Meaning | Source |
| --- | --- | --- |
| `?` | Waiting for tool permission | pending permission request |
| `⋯` | Answer still streaming | assistant has no `time.completed` |
| `✗` | Failed | `finish: "error"` or a tool ended in error |
| `±` | Finished and changed files | `snapshot.files` is not empty |
| `✓` | Finished | `finish: "stop"` with text |
| `≡` | Session compaction | a `compaction` message |

The `Q` number is tinted by agent: `plan` uses the theme warning colour and
`build` a darker blue. Both can be overridden.

## Language

The UI defaults to English, because OpenCode's own interface is English-only and
does not expose a language setting. Indonesian is bundled:

```json
{ "options": { "language": "id" } }
```

Available: `en` (default), `id`. Unknown values fall back to English.

## Install

Requires OpenCode V2 (tested on 2.2.5). This is a TUI-only plugin.

### From npm

```sh
opencode plugin add npm:opencode-qa-index
```

Then add it to `~/.config/opencode/cli.json`:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["opencode-qa-index"]
}
```

### From a local checkout

```sh
git clone https://github.com/<you>/opencode-qa-index.git
```

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["/absolute/path/to/opencode-qa-index"]
}
```

On Windows, forward slashes work: `"D:/opencode-qa-index"`.

OpenCode also discovers plugins placed directly in
`~/.config/opencode/plugins/<name>/`, but do not enable both at once — the
section would render twice.

## Options

Pass options through `cli.json`:

```json
{
  "plugins": [
    {
      "package": "opencode-qa-index",
      "options": {
        "language": "en",
        "rows": 12,
        "pageSize": 200,
        "maxPages": 50,
        "titleLength": 18,
        "planColor": "#ff8c00",
        "buildColor": "#1b3a6b"
      }
    }
  ]
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `language` | `en` | Interface strings: `en` or `id` |
| `rows` | `12` | Visible rows before the list scrolls |
| `pageSize` | `200` | Messages per history request (server caps this) |
| `maxPages` | `50` | Safety bound for very large sessions |
| `titleLength` | `18` | Characters of the question shown in a row |
| `planColor` | theme warning | Colour of `Q` for turns answered by `plan` |
| `buildColor` | dark blue | Colour of `Q` for turns answered by `build` |

## How the jump works

OpenCode has no public `scrollToMessage` API. The plugin dispatches the built-in
navigation commands (`session.messages_last_user`, `session.message.user.previous`,
`session.message.next`) with a short delay between steps. That is best-effort:
it reaches rows the transcript has mounted, and it may break if those command ids
change. Everything is isolated in `jump()` in `tui.tsx`.

History is fetched from the local server, never from a model, so it costs no
tokens.

## Development

```sh
npm test          # node --test: model, pagination, strings, contract, scenarios
```

There is no build step: OpenCode loads the TypeScript sources directly.

## License

MIT
