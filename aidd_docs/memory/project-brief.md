# Project Brief

## What it is

- A plugin marketplace of SDLC workflows for AI coding tools; the supported tools are in [`docs/COMPATIBILITY.md`](../../docs/COMPATIBILITY.md).
- `aidd`, published as `@ai-driven-dev/cli`, installs them once per tool and records every file it writes.
- For developers who work with an AI assistant daily and want repeatable output.

## Why it exists

- An assistant rediscovers the project every session; memory plus fixed workflows make one request produce comparable work twice.
- Workflows are tool-agnostic markdown, written once and translated per tool.

## Main journey

1. `aidd setup --ide <ids>` installs the framework for those tools; `--global` for the whole machine.
2. `aidd marketplace add` registers a marketplace; `aidd plugin install` adds its plugins.
3. `aidd doctor` reports drift; `aidd sync` repairs it.
4. `aidd clean` removes what was installed.

## Domain language

| Term | Meaning |
| --- | --- |
| Plugin | installable package of skills around one concern, listed in `.claude-plugin/marketplace.json` |
| Marketplace | where plugins come from; registered per project or per machine |
| Concern | what a plugin owns; decides where a capability lives |
| Skill | a router: `SKILL.md` dispatching a request to its actions |
| Action | one atomic step of a skill |
| Agent | isolated executor; returns only a result |
| Rule | coding standard the tool injects into its context |
| Memory | the bank under `aidd_docs/memory/`, loaded every session |
| Manifest | `.aidd/manifest.json`: every installed file with its hash and scope |
| Context | a bounded area of the CLI code, the unit that owns a concern |
| Capability | configuration a tool profile hosts: mcp, hooks or settings |
| Usage record | one billed model call, attributed to the declared task |
| Promote | sending `next` to `main`, which opens the release |

## Key features

| Capability | Entry |
| --- | --- |
| Build a target-native plugin tree | `aidd translate <source> --to <tool> --out <dir>` |
| Count token consumption locally | `aidd telemetry`, `aidd-telemetry:00-init`, `aidd-telemetry:01-usage` |
| Project memory | `aidd-context:02-project-memory` |

The plugins and their skills are listed in `.claude-plugin/marketplace.json`.
