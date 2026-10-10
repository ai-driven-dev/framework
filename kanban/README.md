# kanban

Reads a project's `aidd_docs/` frontmatter and shows its task documents as status columns, either as a full-screen interactive view or as a scriptable export.

This folder is not a published package and the AIDD CLI no longer mounts it. It runs standalone through `pnpm board` (below); a host can still mount the commands through `registerKanban` in `src/index.ts`.

## Origin

Written by Francois Duval as the standalone `ai-driven-dev/cli-kanban` project, moved here with his agreement. The three task folders under `aidd_docs/tasks/` are his original specs, plans and reviews, kept as the decision record for why the tool is shaped the way it is.

## Use

```bash
pnpm board [path]              # interactive view, defaults to the current directory
pnpm board list [path]         # scriptable table
pnpm board list [path] --json  # the board as JSON (BoardDto)
pnpm board web [path]          # browser board with live refresh, on 127.0.0.1
```

Filters apply to both views and combine freely:

- `--type <type>` and `--status <status>` match the document's raw frontmatter fields.
- `--progress <progress>` matches a normalized bucket: `todo`, `in-progress`, `done`, `blocked`, `unknown`.
- `--all` also shows task groups whose parent document has no known status.

Each directory under `aidd_docs/` becomes one task group: a parent document (`plan.md` or `master-plan.md`, falling back to `spec.md`, falling back to the first document found) and its sub-documents nested beneath it. A column is rendered per distinct literal parent status; a sub-document's own status never moves its parent into another column.

## Develop

Tests, lint and type-check run here:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

Nothing here may import from `../cli`. Everything the commands need from their host arrives through `KanbanCommandDeps` at registration time.
