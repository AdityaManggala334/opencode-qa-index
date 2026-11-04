# opencode-qa-index

![test](https://github.com/AdityaManggala334/opencode-qa-index/actions/workflows/test.yml/badge.svg)

A sidebar index of every prompt in an [OpenCode](https://opencode.ai) V2 session:
the question, when you asked it, which agent answered, and the status of the
answer. Click a question to jump to it in the transcript, or click the status
glyph to jump to the beginning of its answer.

```
▼ History (19)
 Q1  [09.30] configure the settings so that…   ✓
 Q2  [09.41] is OpenCode an option…            ±
   ≡ [09.52] summary
 Q3  [10.02] refactor auth…                    ⋯
search…
```

History is read from the local server, never from a model: the panel costs no
tokens and stores no prompts. TUI-only; requires OpenCode V2 (tested on 2.2.1
and 2.2.5).

## Install

The cheapest way — no dependencies, no configuration. OpenCode discovers plugins
in its plugin directory:

```sh
git clone https://github.com/AdityaManggala334/opencode-qa-index.git \
  ~/.config/opencode/plugins/opencode-qa-index
```

Reload the TUI (`/reload`) and the section appears.

### With options

Point `cli.json` at a checkout instead. Options are only passed from this file —
`opencode.json` takes a package name, without options:

```json
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-qa-index",
      "options": { "language": "id" }
    }
  ]
}
```

### From npm

```sh
opencode plugin add npm:opencode-qa-index
```

The CLI loads the `./tui` part of a registered package automatically, so there
is nothing else to configure — and do not also list it in `cli.json` just to
enable it. Use both at once and the section renders twice.

This route installs the OpenTUI and Effect runtime next to the plugin (a few
hundred MB in OpenCode's plugin cache). The git clone above needs none of it.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `language` | `en` | Interface strings: `en` or `id` |
| `rows` | `12` | Visible rows before the list scrolls |
| `pageSize` | `200` | Messages per history request (server caps this) |
| `maxPages` | `50` | Safety bound for very large sessions |
| `titleLength` | `18` | Characters of the question shown in a row |
| `planColor` | theme warning | Colour of `Q` for turns answered by `plan` |
| `buildColor` | dark blue | Colour of `Q` for turns answered by `build` |

## Status glyphs

| Glyph | Meaning |
| --- | --- |
| `?` | Waiting for tool permission |
| `⋯` | Answer still streaming |
| `✗` | Failed |
| `±` | Finished and changed files |
| `✓` | Finished |
| `≡` | Session compaction |

The `Q` number is tinted by the agent that answered the turn.

## Caveats

- Jumping replays OpenCode's own navigation commands, one message per step at
  about 40ms, so a jump to an early turn in a long session takes seconds. It
  breaks if those command ids change.
- A jump reaches the rows the transcript has mounted, not the whole history.
- The glyphs read `finish`, `snapshot.files` and tool state, which are OpenCode
  internals and can move between versions.

## Development

```sh
npm test
```

No build step: OpenCode loads the TypeScript sources directly.

## License

MIT
