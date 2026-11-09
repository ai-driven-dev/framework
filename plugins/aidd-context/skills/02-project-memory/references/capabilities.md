# Capabilities

How a capability is detected and which file it writes.

## Capability table

A file is written to `aidd_docs/memory/` from the template of the same name under `assets/templates/memory/`.

| Capability | File | Meaning | Detected when | Always | Accepted names |
| --- | --- | --- | --- | --- | --- |
| `core` | `project-brief.md` | what it is, for whom, its domain words | always | yes | - |
| `core` | `architecture.md` | stack, decisions, how the parts fit | always | yes | - |
| `core` | `codebase-map.md` | areas, entry points, packages | always | yes | - |
| `core` | `coding-assertions.md` | the checks that make code done | always | yes | - |
| `core` | `testing.md` | how it is tested and run | always | yes | - |
| `core` | `vcs.md` | branches, commits, hosting platform | always | yes | - |
| `ecosystem` | `ecosystem.md` | outside tools and services, and how each is reached | always | yes | `integration.md` |
| `backlog` | `backlog.md` | where work items live and move | backlog artifacts, issue templates, a ticketing tool, or a file naming backlog conventions | no | - |
| `deployment` | `deployment.md` | where it runs and how it ships | a CI config, a `Dockerfile`, or infrastructure-as-code files | no | `infra.md` |
| `api` | `api.md` | the server surface and its conventions | a server framework, or a `routes/`, `controllers/`, or `api/` dir | no | - |
| `cli` | `cli.md` | the command line and its distribution | a `bin` field or a command-line parser | no | - |
| `package` | `package.md` | what it publishes for import | a publishable manifest declaring an importable entry | no | - |
| `auth` | `auth.md` | identity, permissions, sessions | an auth library, auth middleware, or an auth module | no | - |
| `database` | `database.md` | the data store, model, conventions | an ORM or driver, a `migrations/` dir, or a schema file | no | - |
| `data` | `data.md` | datasets, pipelines, models, reproducing a run | notebooks, a data-versioning or ML tool, or pipeline files | no | - |
| `messaging` | `messaging.md` | queues and topics for asynchronous work | a queue or broker with producers or consumers | no | - |
| `realtime` | `realtime.md` | live channels pushed to clients | a websocket or SSE library, or a socket endpoint | no | - |
| `ui` | `ui.md` | front-end rules, routing, accessibility | a web frontend framework (not React Native), or a `components/`, `pages/`, or `views/` dir | no | `design.md`, `forms.md`, `navigation.md` |
| `mobile` | `mobile.md` | the mobile app: platform, native access, release | an `ios/` or `android/` dir, React Native, or Flutter | no | - |
| `desktop` | `desktop.md` | the desktop app: framework, native access, packaging | Electron, Tauri, or a native desktop toolkit | no | - |

| Case | Do |
| --- | --- |
| Detecting | read from the table, from a concrete fact in the repo, never inferred from the domain |
| A file present | its row's capability held when the bank was written |
| A template line in `{{…}}` | a question the writer answers; with no answer it is dropped |
| A conditional row with no answer at all | writes no file; an always row is written whatever |

## Bank tree

| Path | Holds |
| --- | --- |
| `aidd_docs/memory/` | the files of the table, plus a team's own, loaded and kept, never rewritten or removed |
| `internal/`, `external/` | exist even when empty, each with a `.gitkeep`; read on demand |
| `internal/decisions/` | decision records; created with the first one, not by scaffold |

## Writing

| Case | Do |
| --- | --- |
| Which files | each file the sheet names plus every absent always file, minus a capability answered no, against [memory-rules](memory-rules.md) |
| Absent file | fill its template with the sheet's lines, dropping an empty section, unless a misplaced file covers its capability |
| A capability whose Accepted names file exists | write into that file, create no second |
| Existing file | apply the sheet's lines only |
| A `remove` or `replace` line whose answer is not yes | skip it |
| A `move <path> to <path>` line answered yes | move the file |

## Answers

| Answer | Read as |
| --- | --- |
| the person's own words | ids optional |
| `ok` or "all good" | `yes` on every line |
| "all but X" | `yes` on every line but X, in one turn |
| silence on an addition | yes |
| an answer unclear for a line | leaves a `remove` or `replace` on it unapplied |
| `tools: claude, codex` or "wire it into claude" | the tools picked |
| an unanswered `Q` | drops its slot |
| autonomous | only when the caller's instruction answers for the user |
