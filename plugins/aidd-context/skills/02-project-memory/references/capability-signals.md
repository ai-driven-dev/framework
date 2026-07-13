# Capability signals

Which concerns the project genuinely has, so the memory bank is shaped by them and not by a project type.

- A capability holds on a concrete repo fact, never an inferred domain ("a web app, so probably auth").
- The listed evidence is canonical, not closed. An equivalent concrete fact counts.
- No fallback type, no `unknown`.
- Every fire is shown with its evidence. A judged match is never silent.
- The folder gates which templates generate. It is never part of an output path (see `memory-destinations.md`).

## Capability, definition, and folder

| Folder       | Definition (the concern)                               | Evidence (any concrete one, or an equivalent fact)                                              | Concerns (files)            |
| ------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------- |
| `core`       | always                                                 | always                                                                                          | project-brief, architecture, codebase-map, coding-assertions, testing, vcs |
| `ui`         | renders a user-facing interface                        | a web frontend framework in the manifest (not React Native), or a `components/`, `pages/` web UI dir | design, forms, navigation   |
| `api`        | exposes an HTTP or RPC surface                         | a server framework in the manifest, or a `routes/`, `controllers/`, `api/` dir                  | api, integration            |
| `database`   | persists data in a store                               | an ORM or driver in the manifest, a `migrations/` dir, or a schema file                         | database                    |
| `auth`       | authenticates a user or service, or authorizes access  | an auth library (passport, next-auth, clerk, auth0, devise), auth middleware, or a dedicated auth module (oauth, token, credential, or session handling) | auth |
| `realtime`   | pushes live updates over a persistent connection       | a websocket or SSE library (socket.io, ws, pusher, ably)                                         | realtime                    |
| `messaging`  | produces or consumes asynchronous messages             | a queue or broker (kafka, rabbitmq, sqs, bullmq) with producers or consumers                    | messaging                   |
| `deployment` | is built and shipped to a runtime                      | a CI config, or a `Dockerfile`                                                                   | deployment                  |
| `infra`      | provisions infrastructure as code                      | Terraform, Pulumi, Kubernetes, or Helm files                                                     | infra                       |
| `mobile`     | ships a native or cross-platform mobile app            | an `ios/` or `android/` dir, a `pubspec.yaml`, a `Podfile`, or React Native or Flutter           | mobile                      |
| `desktop`    | ships a native desktop app                             | Electron or Tauri                                                                               | desktop                     |
| `package`    | ships a reusable library others import                 | an importable entry (`main`, `module`, `exports`) that is not the CLI bin target, and publishable (not private) | package |
| `cli`        | is run as a command-line tool                          | a `bin` field, or a CLI-parser dependency (commander, yargs, oclif, clap, click)                | cli                         |
| `data`       | processes data or trains models                        | notebooks, a data-versioning or ML tool, or pipeline and model files                            | data                        |
| `monorepo`   | hosts several packages in one repo                     | workspaces, or a monorepo tool (Turborepo, Nx, Lerna)                                            | enriches `core/codebase-map` (the Packages section), no folder |
