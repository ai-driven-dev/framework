# Scenes

What a plan holds and how each part is drawn.

| Template | Fits | Fields it reads |
| --- | --- | --- |
| `terminal-demo` | one command and its output | `window`, optional `flow` |
| `two-panels` | a request beside its result | `panels`, each with `label`, `flex`, `rows` |
| `bullet-grid` | several small changes | `cells`, each with `title`, optional `detail`, `wide` |
| `contributors` | who shipped the release | `logins` |

| Plan field | Holds |
| --- | --- |
| `intro` | `highlights`, the tags shown first |
| `youtube` | `themes`, 1 to 4 short French theme names for the title; `programme`, one `{surface, text}` per surface a scene covers, `text` a French sentence that starts with a verb |

| Scene field | Holds |
| --- | --- |
| `pill` | the theme, top left: `Telemetry`, `Rules`, never a command |
| `title`, `accent` | a short title; the accent takes the gradient |
| `lead` | one plain sentence under the title: what it does for the user |
| `surfaces` | the skills and commands the scene covers, for the check |
| `window` | `label` and `rows` |
| `note` | a line shown after the last row, such as `Example figures.` |

| Row | Shape |
| --- | --- |
| prompt | `{"prompt": "…"}` |
| text | `{"text": "…", "tone": "dim"}` |
| chips | `{"chips": ["…"]}` |
| table | `{"table": {"head": [], "rows": []}}`, a cell may be `{"status": "…"}` or `{"dim": "…"}` |
| code | `{"code": "…"}` |
| check | `{"check": "…", "mark": "!"}` |

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
| intro highlights | 3, of 5 words each, drawn one per line: clear sentences, not labels |
| scene lead | 14 words |
| intro | 5 seconds, 6.5 with highlights |
| scene | 4.5 seconds, plus 1 with a lead, plus 0.7 per item, rounded up to a half second |
| outro | 4 seconds |
| refused words | tokens, envelope, axis, transcript, payload, hook; `telemetry` stays; the demo window is not read, it shows real commands and flags |
| themes | scenes of one theme follow each other |
| YouTube title | 100 characters, built from `youtube.themes` as `Framework - Release 5.12 : Batch, SDLC, Télémétrie et Review` |
