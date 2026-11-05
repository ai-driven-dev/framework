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
| `impact <token or id>…` | JSON: tokens, same-value, elements, screens, journeys, renders, code; a token as its path or its CSS name; exit 2 on an unknown one |
| `extract [--force]` | writes `tokens.json` and the context files from the `code-tokens` files; JSON `written` and `left`; exit 2 with a message, nothing written, when it cannot, or when `tokens.json` exists without `--force` |
| `bump --task <task folder> --change "<text>" [--breaking] <token or id>…` | raises the versions the refs reach, with their rows in `history.md` and their Verdicts rows; JSON `changed` and `left`, the elements reached and not raised; exit 2 with a message, nothing written |
| `bump --task <task folder> --created <id>…` | writes the first row in `history.md` of each record named, `system` as 1.0.0, and with `system` writes `aidd_docs/ui/code-debt.json`; `brand` and an id that has rows refused; JSON `changed`; exit 2 with a message, nothing written |
| `bump --task <task folder> --removed <id>…` | writes a `removed` row one version above each id's last, breaking; an id without rows and `system` refused; JSON `changed`; exit 2 with a message, nothing written |
| `publish [--breaking]` | appends the `system` row to `history.md`: its Task lists every task with an element row and no earlier publication, sorted; major when one of them broke an element or with `--breaking` for tokens alone, else minor; JSON `version` and `tasks`; exit 2 with a message, nothing written, when no task is unpublished |
| `publish <id>…` | sets each element `validated` and writes its fingerprint in the `history.md` row of its version; JSON `validated`, each `id`, `version`, `fingerprint`; exit 2 with a message, nothing written, for an id that is no element, is deprecated, has no row at its version, or whose row already holds a fingerprint: a change of a validated element goes through `bump` |

## Output

`validate`, `tokens` when it blocks, and the hook print problems alike:

```
aidd-ui: <n> errors, <m> warnings
<file>[:<line>] <rule> ["<excerpt>"] => <fix>
<rule> ×<count> in <folder>/* ["<excerpt>"] => <fix>
<file>[:<line>] <rule> warning <message> => <fix>
```

- The first line counts the errors, those a hook reports as reached included, then the warnings.
- An error line carries its rule, the offending text when there is one, and the `=> fix` that clears it; the fix names the engine command when the engine owns the write. `<engine>` in a fix is this engine's path.
- Reached errors are the ones in files a write reached without being written: the same rule, fix and folder make one `×<count>` line. `validate` has no reached errors.
- A warning line also carries its message. `validate` prints every error and every warning; the hook, at most ten warnings.
- Rules `U1` (a file that cannot be read), `U2` (a check that failed) and `U3` (a design system written for another format) belong to no family.
- After a write the hook prints the errors of the written files, the errors of what they reach, and the warnings of the written files. At Stop it prints the errors of the files the turn listed, then those of what they reach, or every other error once a shell command marked the turn; no warning.

## Fingerprint

H8 holds a validated element to the fingerprint `publish <id>` wrote: the first 12 hex characters of a sha256 over, in order, each part as its label, a NUL, its content and a NUL:

1. `record`: the record without its `status` and `code` lines, without a byte order mark, line ends as `\n`;
2. `render`: its render, read as the record is, when there is one;
3. `asset`: an asset's `file`, byte for byte, when there is one;
4. `tokens`, always: one `<token> TAB <context> TAB <value>` line per token it uses, its own and those of the elements it uses, and per context of `tokens.css` where it resolves, sorted and joined by `\n`; empty when none resolves.

A theme, platform or breakpoint added or removed changes the fingerprint of every element using a token. An asset file whose line ends change, as a checkout may, changes its fingerprint.

## Code debt

A colour literal is a hex or `rgb()`/`hsl()` colour in a string, a stylesheet, markup or an XML resource, or a colour written as numbers in the code: a colour type (`Color`, `UIColor`) or Swift's `#colorLiteral` called with a number first, as `Color(0xFF2563EB)` or `UIColor(red: 0.2, …)`, or a colour property set to a hex number. `aidd_docs/ui/code-debt.json` counts each colour literal of each code file as the system started, `{ "<file>": { "<literal>": <count> } }`. C4 warns on a literal its file holds no more times than counted, and fails on every occurrence beyond; without the file, on every literal.

- The engine never lowers the debt: a literal fixed leaves its count, room for a new one, until the file is edited by hand.
- A moved or renamed code file loses its debt.
- A code root added later has no debt.
- A `code-debt.json` that is not JSON fails the whole code check, as one problem.
- A deleted `code-debt.json` is never written again: every literal stays an error.

## Owed by a later step

| Problem | Gone once |
| --- | --- |
| T1, `tokens.json` missing | the tokens are written |
| T6, resolver missing | `tokens` ran |
| T10, `tokens.css` missing or stale | `tokens` ran |
| H1, record without a row in `history.md` | `bump --created` ran |
| C4, `code-debt.json` missing | `bump --created system` ran |
| V1, record without render | its render is written |
