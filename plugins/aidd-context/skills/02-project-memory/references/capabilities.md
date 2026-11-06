# Capabilities

The one place that says how a capability is detected, which file it writes, and where.

- Read from this table, never derived.
- A scan detects from a concrete fact in the repo, or an equivalent one, never inferred from the domain.
- In a monorepo, every workspace is scanned, never the root manifest alone.
- Read backwards, it names the capabilities a bank already holds: a file present means its row's capability held when the bank was written.

## Capability table

A file is written to `aidd_docs/memory/` from the template of the same name under `assets/templates/memory/<capability>/`.

| Capability | File | Meaning | Detected when | Always | Accepted names |
| --- | --- | --- | --- | --- | --- |
| `core` | `project-brief.md` | what the project is, for whom, and its domain words | always | yes | - |
| `core` | `architecture.md` | the stack, the decisions and how the parts fit | always | yes | - |
| `core` | `codebase-map.md` | the top-level areas, entry points and packages | always | yes | - |
| `core` | `coding-assertions.md` | the checks that must pass for code to count as done | always | yes | - |
| `core` | `testing.md` | how the project is tested and run | always | yes | - |
| `core` | `vcs.md` | the branches, commits and hosting platform | always | yes | - |
| `ecosystem` | `ecosystem.md` | the tools and services outside the repo, and how each is reached | always | yes | `integration.md` |
| `backlog` | `backlog.md` | where work items live and how they move | local backlog artifacts, issue templates, a ticketing tool in use, or a repo file naming backlog conventions | no | - |
| `deployment` | `deployment.md` | where the project runs and how it ships | a CI config, a `Dockerfile`, or Terraform, Pulumi, Kubernetes, or Helm files | no | `infra.md` |
| `api` | `api.md` | the server surface: style, conventions and compatibility | a server framework, or a `routes/`, `controllers/`, or `api/` dir | no | - |
| `cli` | `cli.md` | the command line: its conventions and distribution | a `bin` field or a command-line parser (commander, yargs, oclif, clap, click) | no | - |
| `package` | `package.md` | what the project publishes for others to import | a publishable manifest declaring an importable entry (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`) | no | - |
| `auth` | `auth.md` | who a caller is, what they may do, and how sessions live | an auth library (passport, next-auth, clerk, auth0, devise), auth middleware, or an auth module | no | - |
| `database` | `database.md` | the data store, its model and its conventions | an ORM or driver, a `migrations/` dir, or a schema file | no | - |
| `data` | `data.md` | the datasets, pipelines and models, and how a run is reproduced | notebooks, a data-versioning or ML tool, or pipeline and model files | no | - |
| `messaging` | `messaging.md` | the queues and topics that carry asynchronous work | a queue or broker (kafka, rabbitmq, sqs, bullmq) with producers or consumers | no | - |
| `realtime` | `realtime.md` | the live channels pushed to clients | a websocket or SSE library (socket.io, ws, pusher, ably, channels, actioncable), or a socket endpoint | no | - |
| `ui` | `ui.md` | the front-end rules, routing and accessibility bar | a web frontend framework (not React Native), or a `components/`, `pages/`, or `views/` dir | no | `design.md`, `forms.md`, `navigation.md` |
| `mobile` | `mobile.md` | the mobile app: platform, native access and release | an `ios/` or `android/` dir, a `pubspec.yaml`, a `Podfile`, React Native, or Flutter | no | - |
| `desktop` | `desktop.md` | the desktop app: framework, native access and packaging | Electron, Tauri, or a native desktop toolkit (Qt, GTK, WPF, AppKit) | no | - |

`Accepted names`: names a bank already holds from an older layout.

- Such a file is kept, reviewed and written into as its row's file; it is offered nothing.
- No second file is written for a conditional capability one of its names already covers.
- A project exposing several surfaces gets one file per surface: `api`, `cli` and `package` are separate rows.

A template line in `{{…}}` is a question the writer answers.

- A question with no answer is dropped.
- A conditional row with no answer at all writes no file.
- An always row is written whatever.

## Bank tree

```txt
aidd_docs/
├── README.md
└── memory/
    ├── <file>.md
    ├── internal/
    └── external/
```

- `assets/templates/README.md` is copied to `aidd_docs/README.md` only when absent, as is.
- `memory/` holds the files of the table at its root, plus a team's own, loaded and kept, never rewritten or removed.
- `internal/` and `external/` exist even when empty, each with a `.gitkeep`. Both are read on demand.
- `internal/decisions/` holds decision records; it is created when the first one is written, not by scaffold.
- A hook refreshes the memory file list; nothing in the bank lists files by hand.
