---
objective: "A Docker Sandbox mixin kit installs the AIDD framework (Claude-only, aidd-ui excluded) into a sandbox, survives the runtime's settings overwrite, and publishes to ghcr.io/ai-driven-dev on release."
status: implemented
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Docker Sandbox kit for AIDD

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Ship `kits/aidd/` as a Docker Sandbox v2 mixin kit that installs the AIDD marketplace and its recommended plugins (Claude Code only, `aidd-ui` excluded) into a sandbox, keeps them enabled past the runtime's settings overwrite, and is published to `ghcr.io/ai-driven-dev` on every framework release. |
| **Source** | https://github.com/ai-driven-dev/framework/issues/678 |

## Phases

| #   | Phase                           | File                         |
| --- | -------------------------------- | ---------------------------- |
| 1   | Kit descriptor                  | [`phase-1.md`](./phase-1.md) |
| 2   | Managed-settings regression test | [`phase-2.md`](./phase-2.md) |
| 3   | CI wiring and docs               | [`phase-3.md`](./phase-3.md) |

## Resources

<!-- External sources only (URLs, docs), not code files. Omit if none consulted. -->

| Source | Verified          |
| ------ | ----------------- |
| https://docs.docker.com/ai/sandboxes/customize/kit-reference/ | `spec.yaml` v2 schema: `schemaVersion`, `kind: mixin`, `setup.install`, `agentInstructions`, `permissions.network` |
| https://docs.docker.com/ai/sandboxes/customize/kits-v2/ | `sbx kit add` on an existing sandbox supports only mixin kits limited to `environment`, `setup.install`, `setup.startup`, `permissions.network.allow` — matches this kit's scope |
| https://docs.docker.com/reference/cli/sbx/kit/push/ | `sbx kit push <dir> <registry>/<repo>:<tag>` publishes a kit directory as an OCI artifact |
| https://github.com/crocogiciel/docker-sbx-template (`.github/workflows/cd.yml`, `ci.yml`, `kits/aidd/spec.yaml`) | the only working reference implementation: `sbx` has no standalone distribution (pulled from the `docker/sbx-releases` release tarball); `sbx kit push` of a brand-new OCI artifact 403s under `GITHUB_TOKEN` and needs a dedicated PAT with `write:packages`; the sandbox runtime overwrites `~/.claude/settings.json` at session start, so plugin state must be merged into `/etc/claude-code/managed-settings.json` instead, which the runtime does not overwrite |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision   | Why   |
| ---------- | ----- |
| The kit lives at top-level `kits/aidd/`, not under `plugins/` | `plugins/` is the native Claude Code plugin format only; a Docker Sandbox kit is a packaging artifact for a different consumer, a sibling area to `cli/` and `kanban/`, not a plugin |
| Install uses native `claude plugin marketplace add` / `claude plugin install`, not the `aidd` npm CLI | matches the maintainer-validated proof of concept; keeps the sandbox image free of a Node/pnpm dependency for this one step |
| `aidd-ui` is excluded from the install loop by default | explicit maintainer decision on the issue ("leave aidd-ui opt-in while alpha") — the reference implementation installs it and is not a template to copy here |
| Plugin state is merged into `/etc/claude-code/managed-settings.json`, never written to `~/.claude/settings.json` | the sandbox runtime replaces the user settings file at every session start; the managed file is the only location that survives and takes precedence |
| The kit's own `version` in `spec.yaml` is bumped by hand, decoupled from release-please | avoids adding a new release-please package for one mixin kit; the OCI tag it produces is the pinned reference the maintainer asked for |
| `build-and-push-kit` is gated on `release-please`'s `release_created` output, mirroring `build-and-attach`/`build-per-tool` | keeps one release cadence instead of pushing a kit image on every commit to `main` |
