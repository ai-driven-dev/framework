# CLAUDE.md

The root `CLAUDE.md` sets behaviour and also loads here. This file loads the CLI's own memory.

- Do not commit or push unless the user asks.

## Project memory

<!-- aidd_project_memory:start -->

@aidd_docs/memory/architecture.md
@aidd_docs/memory/cli.md
@aidd_docs/memory/codebase-map.md
@aidd_docs/memory/coding-assertions.md
@aidd_docs/memory/deployment.md
@aidd_docs/memory/ecosystem.md
@aidd_docs/memory/project-brief.md
@aidd_docs/memory/testing.md
@aidd_docs/memory/vcs.md

<!-- read on demand, not auto-loaded -->
- aidd_docs/memory/internal/auth.md
- aidd_docs/memory/internal/decisions/clean-drives-the-host-cli.md
- aidd_docs/memory/internal/decisions/framework-source-is-machine-scope.md
- aidd_docs/memory/internal/decisions/marketplace-identity-is-name-plus-plugins.md
- aidd_docs/memory/internal/decisions/plugin-enablement-carries-its-scope.md
- aidd_docs/memory/internal/decisions/self-update-version-source-npm.md
- aidd_docs/memory/internal/distribution.md
- aidd_docs/memory/internal/host-registration.md
- aidd_docs/memory/internal/smoke-real.md
- aidd_docs/memory/internal/telemetry.md

<!-- folders other plugins own, read on demand -->
- aidd_docs/tasks/

<!-- aidd_project_memory:end -->

- Load `aidd_docs/memory/external/*` when the user asks.
- Load `aidd_docs/memory/internal/*` when the task needs it.
