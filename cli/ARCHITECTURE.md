# Architecture

## Contexts, not layers

```
presentation ──> contexts ──> kernel
runtime ─────────> (wiring only)

framework ──> translate ──> tools ──> kernel
framework ──> distribution ─────────> kernel
```

| where | what lives there |
|---|---|
| `src/kernel/` | the vocabulary every context speaks: tool identity, source location, paths, files and fingerprints, merge strategies, errors, and the ports used by two contexts or more. It imports no context and carries no business logic. |
| `src/contexts/tools/` | what the project targets and how each target is configured. One directory per tool: its profile beside its build contracts. |
| `src/contexts/translate/` | canonical source into target-native content, at every level. |
| `src/contexts/distribution/` | where content comes from and how it is fetched. A leaf: it knows no tool and no installation record. |
| `src/contexts/framework/` | the installation record and everything done to a project. The only context allowed to reach the others. |
| `src/presentation/` | what speaks to a human: commands, display, prompts, output. |
| `src/runtime/` | technical services and wiring: auth, http, git, platform, project root, self-update, one wiring module per context. |

Four invariants hold this together, and none of them is enforced by this document.

**Which contexts may see each other.** `tests/architecture/context-graph.arch.test.ts`
allows exactly the edges drawn above; the edges the tree has and the chain forbids are
listed in that file with what each admits, measured.

**What of a context is visible.** `tests/architecture/context-boundary.arch.test.ts`
refuses an import that reaches a context's interior: a cross-context import targets a
module that context declares public, and there is no barrel file anywhere to make that
convenient. Every context on disk must appear in that list, or it would be skipped rather
than held.

**Which way the layers point.** Inside a context, `application` may call `domain` and
`domain` may never call `application`, `infrastructure`, `presentation` or `runtime`;
`application` may not call `infrastructure` either — it takes a port and the composition
root supplies the adapter. This one is enforced by biome overrides rather than by a test,
and it holds against a type-only import, a dynamic import and any depth of `../`.
`tests/architecture/import-rules-bite.arch.test.ts` checks that each of those overrides
still names a path that exists, because a pattern matching nothing enforces nothing.

**What the kernel may know.** A biome override refuses an import from the kernel into any
context. A module belongs there when two areas speak it, which
`tests/architecture/earned-sharing.arch.test.ts` measures.

The layer rule stops at relative paths on purpose. A domain file may import `node:path` and
`smol-toml`: both are pure — string manipulation and serialization, no I/O, no lifecycle —
and forbidding them would mean injecting a TOML serializer through a port to gain nothing.
The rule exists to keep I/O and human interaction out of the domain, not imports.

## Key Domain Models (manifest v6)

| Model | Description |
|---|---|
| `SetupFlow` | Aggregate carrying all setup parameters (source, tools, pluginMode, interactive) |
| `MarketplaceSourceMode` | Value object: `remote()` or `local(path)` |
| `Marketplace` | A registered marketplace (name, source, scope). Registry stored at `.aidd/marketplaces.json`, not in the manifest |
| `MarketplaceCacheEntry` | Cached catalog fetch (marketplace name, fetchedAt, size) |
| `Manifest` (v6) | Top-level schema: `version`, `tools`. Plugins live per-tool under `tools[id].plugins`. Stripped top-level fields: `docsDir`, `repo`, `mode`, `scripts`, `plugins`, `topPlugins`, `marketplaces`. Stored at `.aidd/manifest.json` |
| `Plugin` | Installed plugin: id, source (marketplace + version), tool, files |
| `PluginDistribution` | Capability files for a plugin as fetched from the source |

## Command Surface (grammar, not noun-first)

A bare verb is an action performed now, on the CLI or the current project. A noun then a
verb manages a resource's lifecycle — same convention Claude Code and Codex follow.

```
# actions — bare verb
aidd setup                              — bootstrap the whole project (marketplace + framework + tools + plugins)
aidd doctor    [--tool ...] [--plugin]  — detected/equipped tools, plugins, drift, problems
aidd sync      [--tool ...] [--plugin]  — regenerate owned files, driven by the manifest
aidd translate <source> --to <target>   — convert an arbitrary source, records nothing
aidd update | upgrade                   — update the CLI itself
aidd clean                              — remove all AIDD-managed files
aidd auth                               — credential management (login/logout/status)

# resources — noun then verb
aidd framework    install | update | remove          [--tool ...]
aidd plugin       install | update | remove | list | search   [--tool ...]
aidd marketplace  add | refresh | remove | list
```

Phase 18 (`aidd_docs/tasks/2026_08/2026_08_20_refactor-contextes-cli/`) moved the surface:

| Removed | Replacement |
|---|---|
| `aidd ai <verb>` / `aidd ide <verb>` | `--tool <id>` on `doctor`, `sync`, `framework install\|update\|remove` |
| `aidd status`, `aidd ai status`, `aidd ide status` | `aidd doctor` |
| `aidd ai doctor`, `aidd ide doctor`, `aidd plugin doctor` | `aidd doctor --tool` / `aidd doctor --plugin` |
| `aidd restore`, `aidd ai restore`, `aidd ide restore` | `aidd sync` |
| `aidd self-update` | `aidd update` |
| `aidd framework build` | `aidd translate` |
| `aidd plugin create` | removed — never documented, never used |

`aidd cache`, `aidd config`, top-level `aidd install`, and top-level `aidd uninstall` were removed in an earlier pass. Plugin browsing is folded into `aidd plugin install` (no arg); marketplace cache is managed via `aidd marketplace refresh --force`.

## Plugin Architecture

Plugins are distributed via marketplace catalogs (Git repos with `marketplace.json` + `plugins/`). Each plugin provides capability files (agents, commands, hooks, mcp, rules, skills) per AI tool format. The CLI translates plugin distributions between tool formats using reverse + forward content rewriting (plugin sync pipeline).

Memory ownership (CLAUDE.md, AGENTS.md, copilot-instructions.md) is delegated to the `aidd-context` plugin — not bundled in the CLI binary.

## Translate (author-side)

`aidd translate` converts a Claude-format framework source into a target-native distribution. The orchestrators (`MarketplaceBuildStrategy`, `FlatBuildStrategy`) read a per-tool `ToolBuildContract` without per-tool branching. **Scope:** skills, agents, mcp, and hooks are emitted; `rules` and `commands` are out of scope (warn + skip per plugin). The [CLI reference](README.md#translate) owns the supported targets and output layout matrix.

## Hook adaptation

OpenCode needs JS adapters. The CLI owns the shared host protocol; plugins own payload mapping. Its helper is delivered once outside plugin discovery, tracked as a tool file, and backfilled only when missing. Installation must neither rewrite user configuration nor claim existing untracked helpers. Generic `SessionStart` runs idempotently at host initialization.

<details>
<summary>Tool compatibility and adapter contracts</summary>

Hooks are authored with `${CLAUDE_PLUGIN_ROOT}`; the installer translates the root for each tool.
| Tool           | Runs bundled hooks    | Plugin root            | Notes |
| -------------- | --------------------- | ---------------------- | ----- |
| Claude Code    | yes                   | `${CLAUDE_PLUGIN_ROOT}` | Authoring spelling, nothing substituted |
| Codex          | yes                   | `${PLUGIN_ROOT}`       | Also expands `${CLAUDE_PLUGIN_ROOT}`; runs a hook only once trusted |
| GitHub Copilot | yes                   | `${PLUGIN_ROOT}`       | Declared, never observed running |
| Cursor         | declared              | `./`                   | Own hook format: the converter rewrites the root to a plugin-relative path before token substitution. No plugin hook observed firing headless; what registers a plugin in Cursor's plugin directory is unknown |
| OpenCode       | no, by a second route | —                      | See below |
Runtime contracts: [hook bridge](src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts), [shared V2 adapter](assets/configs/opencode/opencode-events.js.txt). The shared helper is `.opencode/hooks/opencode-events.js`. Unsupported hooks and skipped installation surfaces must be reported.

</details>

## Dependency Wiring

- `createDeps(projectRoot, globalOptions, output)` — full dep graph, memoized per project root
- `createMenuDeps()` — pre-parse only (ManifestRepository + Prompter)
- `deps.ts` assembles the entire adapter graph; commands never instantiate adapters directly

## Testing

- `*.unit.test.ts` — domain models, pure functions; no I/O
- `*.integration.test.ts` — use-cases and adapters with real temp filesystem
- `*.e2e.test.ts` — full CLI binary invocation via `runCli()`, temp dir per test
