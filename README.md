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

TUI-only, and requires OpenCode V2 (tested on 2.2.1 and 2.2.5). History is read
from the local server, never from a model: the panel costs no tokens and stores
no prompts.

## Install

```sh
opencode plugin add npm:opencode-qa-index
```

Then add it to `plugins` in `~/.config/opencode/cli.json`:

```json
{ "plugins": ["opencode-qa-index"] }
```

To set options, use an object entry instead:

```json
{ "plugins": [{ "package": "opencode-qa-index", "options": { "language": "id" } }] }
```

Without npm, clone it where OpenCode auto-discovers plugins — no config needed:

```sh
git clone https://github.com/AdityaManggala334/opencode-qa-index.git \
  ~/.config/opencode/plugins/opencode-qa-index
```

Enabling a checkout that also sits in that directory renders the section twice.

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
  about 40ms. A jump to an early turn in a long session takes seconds, and it
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
