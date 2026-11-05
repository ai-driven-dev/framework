# Capabilities

The one place that says how a capability is detected, which file it writes, and where. Read from this table, never derived.

A scan detects from a concrete fact in the repo, or an equivalent one, never inferred from the domain. In a monorepo, every workspace is scanned, never the root manifest alone.

Read backwards, it names the capabilities a bank already holds: a file present means its row's capability held when the bank was written.

## Capability table

A file is written to `aidd_docs/memory/` from the template of the same name under `assets/templates/memory/<capability>/`.

| Capability | Detected when | File | Always | Former files |
| --- | --- | --- | --- | --- |
| `core` | the project exists | `project-brief.md`, `architecture.md`, `codebase-map.md`, `coding-assertions.md`, `testing.md`, `vcs.md` | yes | - |
| `ecosystem` | the project works through external tools | `ecosystem.md` | yes | - |
| `backlog` | local backlog artifacts, issue templates, a ticketing tool in use, or a repo file naming backlog conventions | `backlog.md` | no | - |
| `ui` | a web frontend framework (not React Native), or a `components/`, `pages/`, or `views/` dir | `design.md`, `forms.md`, `navigation.md` | no | - |
| `api` | a server framework, or a `routes/`, `controllers/`, or `api/` dir | `api.md`, `integration.md` | no | - |
| `database` | an ORM or driver, a `migrations/` dir, or a schema file | `database.md` | no | - |
| `auth` | an auth library (passport, next-auth, clerk, auth0, devise), auth middleware, or an auth module | `auth.md` | no | - |
| `realtime` | a websocket or SSE library (socket.io, ws, pusher, ably, channels, actioncable), or a socket endpoint | `realtime.md` | no | - |
| `messaging` | a queue or broker (kafka, rabbitmq, sqs, bullmq) with producers or consumers | `messaging.md` | no | - |
| `deployment` | a CI config, or a `Dockerfile` | `deployment.md` | no | - |
| `infra` | Terraform, Pulumi, Kubernetes, or Helm files | `infra.md` | no | - |
| `mobile` | an `ios/` or `android/` dir, a `pubspec.yaml`, a `Podfile`, or React Native or Flutter | `mobile.md` | no | - |
| `desktop` | Electron, Tauri, or a native desktop toolkit (Qt, GTK, WPF, AppKit) | `desktop.md` | no | - |
| `package` | a publishable manifest declaring an importable entry that is not the CLI bin (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`) | `package.md` | no | - |
| `cli` | a `bin` field, or a CLI parser (commander, yargs, oclif, clap, click) | `cli.md` | no | - |
| `data` | notebooks, a data-versioning or ML tool, or pipeline and model files | `data.md` | no | - |

`Former files` names the template files a capability replaced. Check offers to merge an old bank's file of that name into the row's file.

## Bank tree

```txt
aidd_docs/
├── README.md
└── memory/
    ├── <file>.md
    ├── internal/
    │   └── decisions/
    └── external/
```

- `README.md` is copied as is.
- `memory/` holds only the files of the table at its root.
- `internal/` and `external/` exist even when empty, each with a `.gitkeep`. `internal/decisions/` holds decision records.
- A team's own root file is loaded and kept, never rewritten or removed.
