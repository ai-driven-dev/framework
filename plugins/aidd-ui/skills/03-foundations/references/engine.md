# Engine

| Install | Path |
| --- | --- |
| plugin | `../../hooks/aidd-ui.cjs` from this skill's folder |
| flat | `hooks/aidd-ui/aidd-ui.cjs` under the tool's folder: `.claude`, `.github`, `.kilo`, `.codex`, `.cursor`, `.opencode` |

A refused `extract`, `bump` or `publish` exits 2 with a message. Nothing is written.

## Commands

### `validate`

- Prints `VALID` when nothing is wrong.
- Else prints the problems, as in Output below.
- Exits 1 only on an error.

### `tokens`

- Writes `aidd_docs/ui/tokens.css`.
- Writes the resolver when needed.
- Exits 1 only when blocked, naming what blocks it.

### `impact <token>…`

- Prints JSON: tokens, same-value, elements, screens, wireframes, journeys, renders, code.
- Takes a token as its path or its CSS name.
- Exits 2 on an unknown one.

### `extract [--force]`

- Writes `tokens.json` and the context files from the `code-tokens` files.
- Prints JSON `written` and `left`.
- Refuses when it cannot.
- Refuses when `tokens.json` exists without `--force`.

### `bump --task <task folder> --change "<text>" [--breaking] <token>…`

- Raises the versions the tokens reach.
- Sets each element reached back to `proposed`.
- Writes its `history.md` row.
- Adds a `pending` row per state.
- The row goes to the `## Verdicts` of each reached screen's review.
- Prints JSON `changed` and `left`.
- `left` holds the elements reached and not raised.

### `bump --task <task folder> --created system`

- Writes the first row of `system` in `history.md`, as 1.0.0.
- Writes `aidd_docs/ui/code-debt.json`.
- Prints JSON `changed`.

### `publish [--breaking]`

- Appends the `system` row to `history.md`.
- Its Task lists every unpublished task with an element row, sorted.
- The version is major when one of them broke an element.
- The version is also major with `--breaking` for tokens alone.
- Otherwise the version is minor.
- Prints JSON `version` and `tasks`.
- Refuses when no task is unpublished.

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
- An error line carries:
  - its rule
  - the offending text, when there is one
  - the `=> fix` that clears it
- The fix names the engine command when the engine owns the write.
- `<engine>` stands for the engine's path.
- A grouped line joins errors of one rule, fix and folder.
- It names the file when all are in it.
- `validate` prints every problem, ungrouped.
- The hook prints at most ten warnings.
- After a write, the hook prints problems on the lines it changed.
- Once per turn it prints errors left new in other files, grouped.
- New means absent at the session's start or the last turn's end.
- At the turn's end it asks once for new errors.
- It asks only for those on lines the turn changed.
- It never asks for a warning, or an error with no line.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T6, resolver missing | `tokens` ran |
| T10, `tokens.css` missing or stale | `tokens` ran |
| H1, record without a row in `history.md` | `bump --created` ran |
| C4, `code-debt.json` missing | `bump --created system` ran |
| T7, a component record cites a token that is gone | the record is updated after |
| V3, a component render cites a token that is gone | the render is updated after |
