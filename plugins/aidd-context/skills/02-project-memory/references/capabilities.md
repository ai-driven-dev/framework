# Capabilities

| Capability | File | Meaning | Detected when | Always | Accepted names |
| --- | --- | --- | --- | --- | --- |
| `core` | `project-brief.md` | what it is, for whom, domain words | always | yes | - |
| `core` | `architecture.md` | stack, decisions, how parts fit | always | yes | - |
| `core` | `codebase-map.md` | areas, entry points, packages | always | yes | - |
| `core` | `coding-assertions.md` | checks that make code done | always | yes | - |
| `core` | `testing.md` | how it is tested and run | always | yes | - |
| `core` | `vcs.md` | branches, commits, hosting | always | yes | - |
| `ecosystem` | `ecosystem.md` | outside services and their access | always | yes | `integration.md` |
| `backlog` | `backlog.md` | where work items live and move | backlog artifacts, issue templates, a ticketing tool, or backlog conventions | no | - |
| `deployment` | `deployment.md` | where it runs and ships | CI config, a `Dockerfile`, or infrastructure-as-code | no | `infra.md` |
| `api` | `api.md` | server surface, conventions | a server framework, or a `routes/`, `controllers/` or `api/` dir | no | - |
| `cli` | `cli.md` | the command line, its distribution | a `bin` field or a command-line parser | no | - |
| `package` | `package.md` | what it publishes for import | a publishable manifest with an importable entry | no | - |
| `auth` | `auth.md` | identity, permissions, sessions | an auth library, middleware, or module | no | - |
| `database` | `database.md` | data store, model, conventions | an ORM or driver, a `migrations/` dir, or a schema file | no | - |
| `data` | `data.md` | datasets, pipelines, models, reproducing a run | notebooks, a data-versioning or ML tool, or pipeline files | no | - |
| `messaging` | `messaging.md` | queues and topics for async work | a queue or broker with producers or consumers | no | - |
| `realtime` | `realtime.md` | live channels pushed to clients | a websocket or SSE library, or a socket endpoint | no | - |
| `ui` | `ui.md` | front-end rules, routing, accessibility | a web frontend framework (not React Native), or a `components/`, `pages/` or `views/` dir | no | `design.md`, `forms.md`, `navigation.md` |
| `mobile` | `mobile.md` | mobile app: platform, native access, release | an `ios/` or `android/` dir, React Native, or Flutter | no | - |
| `desktop` | `desktop.md` | desktop app: framework, native access, packaging | Electron, Tauri, or a native desktop toolkit | no | - |

| Case | Do |
| --- | --- |
| A template line in `{{…}}` | a question the writer answers; with no answer it is dropped |
| A conditional row with no answer at all | writes no file; an always row is written whatever |

- Detect from the table and a concrete repo fact, never the domain.
- A file present means its capability held when the bank was written.
