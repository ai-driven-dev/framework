# Capabilities

How a capability is detected and which file it writes.

- Read from this table, never derived.
- Detect from a concrete fact in the repo, never inferred from the domain.
- Read backwards, a file present means its row's capability held when the bank was written.

## Capability table

A file is written to `aidd_docs/memory/` from the template of the same name under `assets/templates/memory/<capability>/`.

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

- `Accepted names`: names a bank already holds from an older layout; such a file is kept, reviewed and written into as its row's file, offered nothing.
- A project exposing several surfaces gets one file per surface: `api`, `cli` and `package` are separate rows.
- A template line in `{{…}}` is a question the writer answers; with no answer it is dropped.
- A conditional row with no answer at all writes no file; an always row is written whatever.

## Bank tree

```txt
aidd_docs/
├── README.md
└── memory/
    ├── <file>.md
    ├── internal/
    └── external/
```

- `memory/` holds the files of the table at its root, plus a team's own, loaded and kept, never rewritten or removed.
- `internal/` and `external/` exist even when empty, each with a `.gitkeep`. Both are read on demand.
- `internal/decisions/` holds decision records; it is created when the first one is written, not by scaffold.
- A hook refreshes the memory file list; nothing in the bank lists files by hand.

## Writing

- Absent file: fill its template with the sheet's lines, dropping an empty section, unless a misplaced file covers its capability.
- A capability whose Accepted names file exists: write into that file, create no second.
- Existing file: apply the sheet's lines only.
  - Skip a `remove` or `replace` line whose answer is not yes.
  - For a `move <path> to <path>` line answered yes, move the file.
