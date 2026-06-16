# Capability signals

The memory bank is shaped by the concerns the project genuinely has, not by a single project type. The templates live in one folder per capability under `assets/templates/memory/`. The folder is the gate: generate `core/` always, plus the folder of each capability the project has.

A capability holds when a concrete fact in the repo matches the capability's **definition**. The listed signals are canonical evidence, not a closed set: an equivalent concrete fact (a dedicated module, a set of ports) counts too. What never counts is an inferred dominant domain ("it is a web app, so it probably has auth"). There is no fallback type and no `unknown`. Every fire is shown to the user with its evidence at the Confirm step, so a judged match is never silent.

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

## How the action uses this

- Always generate every template in `core/`.
- For each capability that holds, generate every template in its folder.
- Fire a capability on a concrete fact that matches its definition, whether or not the fact is in the Evidence column. Never fire on an inferred domain.
- A capability with no concrete fact produces no file.
- A monorepo fills the Packages section of `codebase-map`, it has no folder of its own.
- In a monorepo, gather facts across every workspace, not the root manifest alone. A capability holds when any one workspace shows it (a React app in `packages/web` means `ui` holds for the project).
