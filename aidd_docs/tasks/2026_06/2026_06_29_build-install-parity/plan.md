---
objective: "Installing a plugin yields byte-identical content to building that plugin for the same target, for all 5 AI tools."
status: in-progress
---

# Plan: Build/Install content parity for all AI tools

## Overview

| Field      | Value                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| **Goal**   | Install consumes framework-build output so installed == built content for every tool           |
| **Source** | User request + design draft `/Users/baptistelafourcade/.claude/plans/modular-popping-stardust.md` |

## Problem

`aidd framework build --target <tool>` transforms plugin content (`rewriteRelativeLinks`
`@../x.md` → `[x.md](../x.md)`; codex agents md→toml; skill path remaps; manifest synthesis)
via `tool-contracts.ts`. The install path does **not**: native-CLI tools (codex/copilot)
register the **raw Claude-format source**, claude points its settings at the raw source, and
materializing tools (cursor/opencode) re-transform via `PluginTranslator` which lacks those
transforms. Result: installed content diverges from built content. Build is the single source
of truth; install must consume build output. Proven: codex/copilot `marketplace add` accept a
local built dir and then materialize transformed content.

## Phases

| #   | Phase                                  | File                         |
| --- | -------------------------------------- | ---------------------------- |
| 1   | Build-cache foundation                 | [`phase-1.md`](./phase-1.md) |
| 2   | codex/copilot register built tree      | [`phase-2.md`](./phase-2.md) |
| 3   | claude repoint settings at built tree  | [`phase-3.md`](./phase-3.md) |
| 4   | cursor materialize from built tree     | [`phase-4.md`](./phase-4.md) |
| 5   | opencode materialize from flat build   | [`phase-5.md`](./phase-5.md) |
| 6   | Cleanup dead path + parity tests       | [`phase-6.md`](./phase-6.md) |

## Resources

| Source                                                              | Verified                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Isolated `CODEX_HOME` `codex plugin marketplace add <built tree>`   | Materializes transformed content (`@` expanded, `.codex-plugin/`); raw source stays `@` verbatim |
| Isolated `HOME` `copilot plugin install aidd-vcs@aidd-framework`    | **Real-binary**: built tree accepted; materialized `[assets/CONTRIBUTING.md](../assets/CONTRIBUTING.md)` (transformed). copilot manifest is `.plugin/marketplace.json`; install dir `~/.copilot/installed-plugins/<mkt>/<plugin>/` |
| Built claude tree vs raw source (same action file)                 | Build rewrites `@../assets/CONTRIBUTING.md` → `[..](..)`; raw keeps `@../` → claude install **does** diverge |
| `framework build --target opencode`                                | **Flat only** (no marketplace mode); writes `.opencode/...` into a workspace + merges opencode.json |
| Framework plugins scanned for `.mcp.json`                          | **Zero** plugins ship MCP today → opencode MCP merge path is forward-looking, not blocking         |
| `framework-build-use-case.ts:47-50` `guardPaths`                   | Throws `InvalidBuildPathsError` when outDir nests under source → dogfood needs temp-build-then-copy |
| `plugin-translator-factory.ts:23,29`                              | `ModeBFlatMaterializationTranslator` serves **only** cursor (user) + opencode (flat) → orphaned after phases 4-5 |
| `src/application/use-cases/shared/resolve-marketplace-use-case.ts`  | Returns `{ localPath, catalog }` for local+remote sources → the source-dir + version seam        |
| `src/infrastructure/deps.ts:337` `createFrameworkBuildUseCase`      | The build-factory seam to invoke a per-target build                                              |
| `src/domain/ports/file-writer.ts`                                  | Has `createDirectory`/`deleteDirectory`, **no** `copyDirectory` → copy via per-file read/write    |

## Decisions

| Decision                                                              | Why                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| One shared `EnsureBuiltMarketplaceUseCase` builds per `(mkt, target)` | Single insertion point for all install consumers; build stays the only transform engine |
| Build whole marketplace, not single plugin                           | `preBuild` wipes outDir and the build loops all plugins; per-plugin into shared dir would race |
| Build to OS temp then copy into `.aidd/cache/built/`                 | `guardPaths` throws when outDir nests under source (dogfood: source == project root)    |
| Staleness sentinel `<cliVersion>:<catalogVersion>`                   | A CLI upgrade that changes transforms must invalidate stale built trees                 |
| cursor/opencode **bypass** `PluginTranslator`, copy built bytes      | Divergence is frontmatter-convert + manifest-synthesis + mcp remap, not just links      |
| github/url sources also built locally, registered as local path     | "Build is the source of truth" — even remote sources consume transformed output         |
| Copy directories via per-file `listFilesRecursive`+read/write        | Avoids adding `copyDirectory` to the fs port (smaller diff)                             |
| Native registration is **remove-then-add**, not add                  | CLI rejects `add` when the name exists from a different source (the original bug for existing users) |

## Open risk (verify during phase-6)

`upgradeMarketplaces()` reported "No configured Git marketplaces to upgrade" for a local
path, and codex caches installed plugins **per version** (`.../aidd-vcs/2.0.0/`). On
`aidd update`, rebuilding new content into the same built path at an **unchanged**
marketplace/plugin version may leave the tool's own cache stale. remove-then-add forces a
re-pull of the marketplace, but per-version plugin caching may still need `enablePlugin`
re-run or a version bump. Verify the update story end-to-end; the install story is proven.
