# Engine

Where the engine is, and what it gives.

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

| Command | Gives |
| --- | --- |
| `validate` | `VALID` when nothing is wrong, else the problems as in Output below; exit 1 only on an error |
| `tokens` | writes `aidd_docs/ui/tokens.css`, and the resolver when one is needed; exit 1 names what blocks it |
| `impact <id>…` | JSON: tokens, same-value, elements, screens, wireframes, journeys, renders, code; exit 2 on an unknown one |
| `bump --task <task folder> --change "<text>" [--breaking] <id>…` | raises the versions the refs reach, each element back to `proposed`, with its row in `history.md` and a `pending` row per state in the `## Verdicts` of each reached screen's review; JSON `changed` and `left`, the elements reached and not raised; exit 2 with a message, nothing written |
| `bump --task <task folder> --created <id>…` | writes the first row in `history.md` of each record named; `brand` and an id that has rows refused; JSON `changed`; exit 2 with a message, nothing written |
| `bump --task <task folder> --removed <id>…` | writes a `removed` row one version above each id's last, breaking; an id without rows and `system` refused; JSON `changed`; exit 2 with a message, nothing written |
| `publish <id>…` | sets each element `validated` and writes its fingerprint in the `history.md` row of its version; JSON `validated`, each `id`, `version`, `fingerprint`; exit 2 with a message, nothing written, for an id that is no element, is deprecated, has no row at its version, or whose row already holds a fingerprint: a change of a validated element goes through `bump` |

## Output

`validate`, `tokens` when it blocks, and the hook print problems alike:

```
aidd-ui: <n> errors, <m> warnings
<file>[:<line>] <rule> ["<excerpt>"] => <fix>
<rule> ×<count> in <file>|<folder>/* ["<excerpt>"] => <fix>
<file>[:<line>] <rule> warning <message> => <fix>
```

- The first line counts the errors, then the warnings.
- An error line carries its rule, the offending text when there is one, and the `=> fix` that clears it; the fix names the engine command when the engine owns the write, `<engine>` standing for the engine's path.
- A grouped line joins errors of the same rule, fix and folder, naming the file when all are in it. `validate` prints every problem, ungrouped; the hook at most ten warnings.
- After a write the hook prints the problems of the lines it changed, then, once per turn and grouped, the errors it left new in other files. New means absent at the session's start or the last turn's end. At the turn's end it asks once for the new errors still on lines the turn changed, never a warning or an error with no line.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| H1, record without a row in `history.md` | `bump --created` ran |
| V1, record without render | its render is written |
