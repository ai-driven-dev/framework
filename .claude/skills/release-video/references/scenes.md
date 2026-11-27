# Scenes

What a plan holds and how each part is drawn.

| Template | Fits | Fields it reads |
| --- | --- | --- |
| `terminal-demo` | one command and its output | `window`, optional `flow`: steps `{n, title, sub, icon, log}`, each working in turn, its `log` lines shown one by one, or `{title, final: true}`; `runs: [{log, fail}]` in place of `log` replays a step: a failed run turns the arrow before it and sends the work back to the step before it, which takes its next run, then the check retries |
| `two-panels` | a request beside its result | `panels`, each with `label`, `flex`, `rows`; `afterWork: true` opens a panel once the other panels' work is done |
| `bullet-grid` | several small changes | `cells`, each with `title`, optional `detail`, `wide`, `icon` (`search`, `build`, `check`, `review`) |
| `before-after` | a change shown as an old card and a new one, such as a leaner skill | `before` and `after`, two windows whose rows are `del` and `add` |
| `contributors` | who shipped the release | `logins` |
| `github-pr` | work done on a pull request, shown on its GitHub page | `pr`: `repo`, `number`, `title`, `author`, `branch`, `base`, optional `checks: [{name, state}]`, `state` one of `pass`, `fail`, `pending`; `threads: [{file, line, author, comment, reply, resolve}]`, 6 at most, each answered in place by `pr.author`, then each with `resolve: true` collapsing to Resolved in its own slot; optional `summary: {kicker, title, lines, sections: [{heading, items, list}]}`, `kicker` a heading above it, posted last in its own slot; optional `prompt`, the command shown in the address bar; `captions`, one per beat: answered, resolved, summary |
| `ide-window` | a session in an editor: its files, its agent panel, what happens in turn | `ide`: `label`, optional `agent` (panel title, `Claude Code` by default), `files: [{path, lines}]`; `steps`, each holding any of `user`, `agent`, `tool` (a tool call), `notice: {label, text, tone, detail}`, `open` (a file shown in the editor), `add` (lines added in place to the open file, drawn green), `file` with `state` `red` or `green` (its tree entry), `caption` (starts a new beat) |
| `tool-grid` | the same thing landing in several tools | `tools: [{name, dir, count}]`, each window filling then lighting up in turn; `captions`, one |
| `architecture-blocks` | parts gathered around one core, and a figure | `core`, `blocks: [{label, detail}]`, `counter: {to, from, label}`, counted up once every block is in place; `captions`, one for the blocks, one for the counter |

| `panel-sequence` | a few big ideas | `panels: [{kind, label, items: [{label, detail}]}]`, `kind` one of `layers`, `grid`, `levels`; by default one panel at a time with its subtitle, each leaving for the next; with `layout: "row"`, side by side under their labels, all at once, and they stay; `captions` |
| `logo-row` | the tools something now runs in | `tools: [{name, logo, new}]`, `logo` a name of the pinned icon set (`-color` for a coloured mark); each `new` tool comes in from the right, one after another, and snaps onto the end of the row with a click and a glow; `captions`, one |
| `gate` | a check standing between the AI and the project | `actor`, `gate`, `target`, `files` (the project's files), `outcomes: [{kind, label, action, file, detail, note, fixed}]`, a write that passes landing on its `file` inside the project, a refused one marking it, `kind` one of `block`, `inform`, `require`, one beat each: the action reaches the checkpoint panel, its light gives the verdict, and the action bounces back, passes with a note that leaves with its beat, or is sent back until fixed; `captions`, one per outcome |
| `model-switch` | a command that changes which models agents run on | `terminal`, `cards`, each labelled `kind` (`main`, set apart, else `subagent`): `[{role, faces: [{model, logo}]}]`, a face without `logo` an empty slot, `runs: [{command, flip, lines: [{text}]}]`: each command is typed and prints its real output, then with `flip` every card turns together to its next face; `captions`, one per run, shown with the flip |
| `doc-lock` | a short document approved, then locked | `file`, `status: [before, after]`, `sections: [{heading, text}]` written in turn, then the status badge turns and an Approved seal lands; `attempt: {action, refusal}`, the edit that bounces off and the real refusal; `captions` |
| `challenge-report` | a spec challenged line by line | `spec: {file, lines: [{text, finding: {tone, label, text, evidence}}]}`; a scanner sweeps the spec, and each line with a `finding` lights and spawns it on the right, linked to it, in its section colour (`red` deal breaker, `amb` to decide, `blu` suggestion, `grn` holds); `captions` |
| `scan-questions` | a text read for what its meaning leaves unclear | `file`, `story`: lines of strings and passages `{text, fixed, gap}`; `gaps: [{category, question}]`; `status: [open, clean]`; the story stays readable, each unclear passage is highlighted, its question appears on the passage's line in story order, then the passage reads precisely and the question closes; `captions` |
| `chain-cards` | the steps of a workflow as a chain of stylised cards | `steps: [{label, skill, keywords, visual, caption}]`, `visual` one of `wireframe`, `direction`, `swatches`, `components`, `screens`, `verdict`, a small abstract picture; each card appears only when its step is reached, left to right; `caption` the index of the subtitle a step brings |
| `contributor-wave` | who shipped the release | `logins`, their avatars arriving in a wave, their count said under the thanks; `captions` |

These product surfaces have a fixed layout:

- A band at the top holds one fixed `title` for the whole scene, the outcome for the user, and under it a light subtitle per beat (`captions`), else `lead`.
- Nothing scrolls, drifts, tilts or skews: an element fades or scales in place, and moves only when the motion is the message, such as a tool sliding in or an edit bouncing off. Nothing outlives its beat.
- Each beat lights what it changes and dims the rest; 3 beats at most.
- Content that does not fit is cut, never scrolled: fewer threads, shorter files.
- Every beat is spread for reading. `hold` adds seconds once the last beat is on screen; `badge` sets a tag beside the title, such as `Rebuilt lean`.
- Copy a surface's real output: the replies a skill posts, the messages a check prints, the files it writes. Mark what is invented with `note`, shown at the bottom right.

| Plan field | Holds |
| --- | --- |
| `intro` | empty by default, which shows `youtube.themes` as the thumbnail does; `highlights`, tags shown instead |
| `youtube` | `themes`, 1 to 4 short French theme names for the title; `programme`, one `{surface, theme, text}` per surface a scene covers, `theme` one of `themes`, `text` a French sentence that starts with a verb |

| Scene field | Holds |
| --- | --- |
| `pill` | the theme, top left: `Telemetry`, `Rules`, never a command |
| `title`, `accent` | a short title; the accent takes the gradient |
| `lead` | optional and left out by default: the picture says it. One plain sentence under the title when a scene cannot be understood without it |
| `surfaces` | the skills and commands the scene covers, for the check |
| `window` | `label` and `rows` |
| `note` | a line shown after the last row, such as `Example figures.` |

| Row | Shape |
| --- | --- |
| prompt | `{"prompt": "…"}` |
| text | `{"text": "…", "tone": "dim"}` |
| chips | `{"chips": ["…"]}` |
| table | `{"table": {"head": [], "rows": []}}`, `head` optional, a cell may be `{"status": "…"}`, `{"dim": "…"}` or `{"tone": "amb", "text": "…"}`; `{"checking": cell, "pending": "installing…"}` shows its `pending` text, `checking…` by default, until its row is done, `{"result": cell}` nothing until then; `"together": true` beside `rows` checks every row at once, all ending together |
| code | `{"code": "…"}` |
| check | `{"check": "…", "mark": "!"}` |
| diff | `{"del": "…"}` drawn red with `-`, `{"add": "…"}` drawn green with `+` |
| verdict | `{"verdict": "FAIL", "tone": "pnk", "detail": "…"}`, a badge in its tone |

Any row with `"afterWork": true` appears once the scene's work is done, such as a verdict after its checks.

| Tone | Means |
| --- | --- |
| `dim` | a quiet line |
| `grn` | success |
| `blu`, `pnk` | emphasis |
| `amb` | a question or a choice |
| `red` | a problem, drawn with a red bar |

| Limit | Value |
| --- | --- |
| intro tagline | optional and left out by default; 6 words when used |
| intro highlights | optional; 5, of 5 words each, drawn one per line in large type: clear sentences, not labels |
| scene lead | 14 words, when there is one |
| intro | 5 seconds, 6.5 with highlights |
| scene with beats | `github-pr`, `ide-window`, `tool-grid`, `architecture-blocks`: until its last beat, plus 1.6 seconds; a step or an answer stays long enough to read its words |
| scene | until its last row, note, run or later row is on screen, plus 2.5 seconds to read, plus 0.5 with a lead, rounded up to a half second; a flow step run takes 1.6, a checked row 0.75, rows checked together 1.5 for the group |
| outro | 4 seconds |
| refused words | tokens, envelope, axis, transcript, payload, hook; `telemetry` stays; the demo window is not read, it shows real commands and flags |
| themes | scenes of one theme follow each other |
| YouTube title | 100 characters, built from `youtube.themes` as `Framework - Release 5.12 : Batch, SDLC, Télémétrie et Review` |
