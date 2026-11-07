# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

A refused `bump` or `publish` exits 2 with a message. Nothing is written.

## Commands

### `validate`

- Prints `VALID` when nothing is wrong.
- Else prints the problems, as in Output below.
- Exits 1 only on an error.

### `tokens`

- Writes `aidd_docs/ui/tokens.css`.
- Writes the resolver when needed.
- Exits 1, naming what blocks it.

### `impact <id>…`

- Prints JSON: tokens, same-value, elements, screens, wireframes, journeys, renders, code.
- Exits 2 on an unknown id.

### `bump --task <task folder> --change "<text>" [--breaking] <id>…`

- Raises the versions the refs reach.
- Sets each element reached back to `proposed`.
- Writes its `history.md` row.
- Adds a `pending` row per state.
- The row goes to the `## Verdicts` of each reached screen's review.
- Prints JSON `changed` and `left`.
- `left` holds the elements reached and not raised.

### `bump --task <task folder> --created <id>…`

- Writes the first row in `history.md` of each record named.
- Refuses `brand`.
- Refuses an id that has rows.
- Prints JSON `changed`.

### `bump --task <task folder> --removed <id>…`

- Writes a breaking `removed` row one version above each id's last.
- Refuses an id without rows.
- Refuses `system`.
- Prints JSON `changed`.

### `publish <id>…`

- Sets each element `validated`.
- Writes its fingerprint in its version's `history.md` row.
- Prints JSON `validated`: each `id`, `version`, `fingerprint`.
- Refuses a deprecated id, or one that is no element.
- Refuses an id with no row at its version.
- Refuses an id whose row holds a fingerprint.
- A change of a validated element goes through `bump`.

## Output

`validate`, `tokens` when it blocks, and the hook print problems alike:

```
aidd-ui: <n> errors, <m> warnings
<file>[:<line>] <rule> ["<excerpt>"] => <fix>
<rule> ×<count> in <file>|<folder>/* ["<excerpt>"] => <fix>
<file>[:<line>] <rule> warning <message> => <fix>
```

- The first line counts errors, then warnings.
- An error line has its rule, any text, and the `=> fix`.
- The fix names the engine command when the engine owns the write.
- A grouped line joins errors of one rule, fix and folder.
- It names the file when all are in it.
- `validate` prints every problem, ungrouped.
- The hook prints at most ten warnings.
- After a write, the hook prints problems on the lines it changed.
- Once per turn, it prints the errors it left new elsewhere, grouped.
- New means absent at the session's start or the last turn's end.
- At the turn's end it asks once for new errors.
- It asks only for those on lines the turn changed.
- It never asks for a warning, or an error with no line.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| H1, record without a row in `history.md` | `bump --created` ran |
| V1, record without render | its render is written |
