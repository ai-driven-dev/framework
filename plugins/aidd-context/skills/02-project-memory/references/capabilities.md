# Capabilities

The one place that says how a capability is detected, which file it writes, and where. Read from this table, never derived.

A scan detects from a concrete fact in the repo, or an equivalent one, never inferred from the domain. In a monorepo, every workspace is scanned, never the root manifest alone.

Read backwards, it names the capabilities a bank already holds: a file present means its row's capability held when the bank was written.

## Capability table

A file is written to `aidd_docs/memory/` from the template of the same name under `assets/templates/memory/<capability>/`.

| Capability | Detected when | File | Always | Former files |
| --- | --- | --- | --- | --- |
| `core` | always | `project-brief.md`, `architecture.md`, `coding-assertions.md`, `testing.md`, `vcs.md` | yes | `codebase-map.md` into `architecture.md` |
| `ecosystem` | always | `ecosystem.md` | yes | `integration.md` |
| `backlog` | local backlog artifacts, issue templates, a ticketing tool in use, or a repo file naming backlog conventions | `backlog.md` | no | - |
| `deployment` | a CI config, a `Dockerfile`, or Terraform, Pulumi, Kubernetes, or Helm files | `deployment.md` | no | `infra.md` |
| `contract` | a server framework, a `routes/`, `controllers/`, or `api/` dir, a `bin` field or CLI parser (commander, yargs, oclif, clap, click), or a publishable manifest declaring an importable entry (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`) | `contract.md` | no | `api.md`, `cli.md`, `package.md` |
| `auth` | an auth library (passport, next-auth, clerk, auth0, devise), auth middleware, or an auth module | `auth.md` | no | - |
| `data` | an ORM or driver, a `migrations/` dir, a schema file, notebooks, a data-versioning or ML tool, or pipeline and model files | `data.md` | no | `database.md` |
| `async` | a queue or broker (kafka, rabbitmq, sqs, bullmq) with producers or consumers, or a websocket or SSE library (socket.io, ws, pusher, ably, channels, actioncable) | `async.md` | no | `messaging.md`, `realtime.md` |
| `ui` | a web frontend framework (not React Native), or a `components/`, `pages/`, or `views/` dir | `ui.md` | no | `design.md`, `forms.md`, `navigation.md` |
| `native` | an `ios/` or `android/` dir, a `pubspec.yaml`, a `Podfile`, React Native, Flutter, Electron, Tauri, or a native desktop toolkit (Qt, GTK, WPF, AppKit) | `native.md` | no | `mobile.md`, `desktop.md` |

`Former files` names the template files a capability replaced. Check offers to merge an old bank's file of that name into the row's file.

A template line in `{{…}}` is a question the writer answers. A question with no answer is dropped, a file with no answer is not written.

## Bank tree

```txt
aidd_docs/
├── README.md
└── memory/
    ├── <file>.md
    ├── internal/
    └── external/
```

- `assets/templates/README.md` is copied to `aidd_docs/README.md` as is.
- `memory/` holds the files of the table at its root, plus a team's own, loaded and kept, never rewritten or removed.
- `internal/` and `external/` exist even when empty, each with a `.gitkeep`. Both are read on demand.
- `internal/decisions/` holds decision records; it is created when the first one is written, not by scaffold.
- A hook refreshes the memory file list; nothing in the bank lists files by hand.
