# Project Brief

## Purpose

- The `aidd` binary, published as `@ai-driven-dev/cli`, installs the AIDD framework into a project, once per AI coding tool.
- Each tool reads a different shape, so the same setup drifts across tools and machines without it.

## Main journey

1. `aidd setup` installs the framework for the chosen tools and records every file it writes.
2. `aidd plugin install` adds plugins from a registered marketplace.
3. `aidd doctor` reports a file changed since it was written, and `aidd sync` repairs it.
4. `aidd clean` removes what was installed.

## Domain language

| Term | Meaning |
| --- | --- |
| Framework | the canonical agents, commands, rules, skills and templates |
| Manifest | `.aidd/manifest.json`, every installed file with its hash and install scope |
| Plugin | capability files grouped under one name, installed per tool from a marketplace |
| Marketplace | where plugins come from, registered per project or per machine |
| Context | a bounded area of this codebase, the unit that owns a concern |
| Capability | a kind of configuration a tool profile declares it hosts: mcp, hooks or settings |
| Usage record | one billed model call, counted once and stored on this machine |

## Key features

| Feature | Entry |
| --- | --- |
| Install plugins, driving a tool's own CLI where its project files are inert | `aidd plugin install` |
| Build a target-native plugin tree, recording nothing | `aidd translate` |
| Count Claude Code and Codex consumption from local files, with no service and no upload | `aidd telemetry` |
