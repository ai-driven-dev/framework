# Scenes

What a plan holds and how each part is drawn.

| Template | Fits | Fields it reads |
| --- | --- | --- |
| `terminal-demo` | one command and its output | `window`, optional `flow`: steps `{n, title, sub, icon, log}`, each working in turn, its `log` lines shown one by one, or `{title, final: true}`; `runs: [{log, fail}]` in place of `log` replays a step: a failed run turns the arrow before it and sends the work back to the step before it, which takes its next run, then the check retries |
| `two-panels` | a request beside its result | `panels`, each with `label`, `flex`, `rows`; `afterWork: true` opens a panel once the other panels' work is done |
| `bullet-grid` | several small changes | `cells`, each with `title`, optional `detail`, `wide`, `icon` (`search`, `build`, `check`, `review`) |
| `before-after` | a change shown as an old card and a new one, such as a leaner skill | `before` and `after`, two windows whose rows are `del` and `add` |
| `contributors` | who shipped the release | `logins` |

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
| scene | until its last row, note, run or later row is on screen, plus 2.5 seconds to read, plus 0.5 with a lead, rounded up to a half second; a flow step run takes 1.6, a checked row 0.75, rows checked together 1.5 for the group |
| outro | 4 seconds |
| refused words | tokens, envelope, axis, transcript, payload, hook; `telemetry` stays; the demo window is not read, it shows real commands and flags |
| themes | scenes of one theme follow each other |
| YouTube title | 100 characters, built from `youtube.themes` as `Framework - Release 5.12 : Batch, SDLC, Télémétrie et Review` |
