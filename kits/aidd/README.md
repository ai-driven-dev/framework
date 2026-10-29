# AIDD kit

A Docker Sandbox mixin kit that installs the [AI-Driven Dev (AIDD)](https://github.com/ai-driven-dev/framework) framework into a `claude-code` sandbox: its marketplace plus `aidd-context`, `aidd-refine`, `aidd-dev`, `aidd-vcs`, `aidd-pm` and `aidd-orchestrator`.

## Install

On an existing sandbox:

```bash
sbx kit add <sandbox> ghcr.io/ai-driven-dev/aidd-sbx-kit:<version>
```

On a new one:

```bash
sbx run claude-code --kit ghcr.io/ai-driven-dev/aidd-sbx-kit:<version>
```

Against this checkout, before it is published:

```bash
sbx run claude-code --kit ./kits/aidd
```

## Scope

- Claude Code only: `setup.install` checks for the `claude` CLI and exits if it is absent.
- `aidd-ui`, `aidd-telemetry` and `aidd-qa` are not installed — they are alpha, beta and unproven respectively. Add one by name after install with `claude plugin install <name>@aidd-framework` to opt in.
- A mixin kit, not a full sandbox template: it extends an existing `claude-code` agent image, it does not build or replace one.
