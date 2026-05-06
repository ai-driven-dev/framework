# Phase 9 — Noun-first surface

> Restructure command surface so domain operations live under noun groups (`ai`, `ide`, `plugin`). Globals stay flat. Eliminate `aidd install [category] [tool…]` verb-first flat form.

## Pre-requisites

- Phase 2 (install legacy purge) landed — `--path/--release` already gone
- Phase 6 (manifest repo + config purge) landed — `--repo` global flag and `aidd config` deleted

## Goal

Today the surface mixes verb-first (`install`, `uninstall`, `update`, `restore`, `sync`, `status`, `doctor`) and noun-first (`plugin`, `marketplace`, `auth`). Phase 9 unifies domain operations under noun-first groups while keeping globals (chain orchestrators) flat.

Target surface:

```
aidd ai install <tool>          aidd ide install <tool>          aidd plugin install <name>
aidd ai uninstall <tool>        aidd ide uninstall <tool>        aidd plugin add <source>
aidd ai list                    aidd ide list                    aidd plugin remove <name>
aidd ai status                  aidd ide status                  aidd plugin list
aidd ai update [tool]           aidd ide update [tool]           aidd plugin update [name]
aidd ai sync --source <tool>    aidd ide doctor                  aidd plugin search <query>
aidd ai restore [files...]                                        aidd plugin pick
aidd ai doctor                                                    aidd plugin status
                                                                  aidd plugin sync --source <tool>
                                                                  aidd plugin restore --plugin <name>
                                                                  aidd plugin doctor
```

Globals stay flat:

```
aidd setup       aidd update       aidd status       aidd sync
aidd restore     aidd doctor       aidd clean        aidd migrate
aidd self-update
```

## Architecture compliance

New files `src/application/commands/ai.ts` and `src/application/commands/ide.ts` mirror the existing `plugin.ts` / `marketplace.ts` pattern (parent command + subcommands).

Each subcommand action body stays a thin wrapper: parse → deps → ONE use-case → display. No business logic in command files.

`ToolCategory` value object (`"ai" | "ide"`) is the contract — used by use cases to filter manifest entries.

Sub-use-cases per scope where missing: `AiListUseCase`, `IdeListUseCase`, `PluginStatusUseCase`, `PluginSyncUseCase`, `PluginRestoreUseCase`, `PluginDoctorUseCase`. Most reuse existing scoped logic (e.g. `StatusUseCase` already accepts `category` filter). New ones extend.

## Steps

### A. Create `aidd ai` parent command

- [ ] `src/application/commands/ai.ts`:
  - [ ] `registerAiCommand(program)` — parent description "Manage AI tools (claude, cursor, copilot, codex, opencode)"
  - [ ] No-arg TTY action → interactive subcommand picker (mirror `plugin.ts` pattern)
  - [ ] Subcommands: `install <tool>`, `uninstall <tool>`, `list`, `status`, `update [tool]`, `sync`, `restore [files...]`, `doctor`
  - [ ] Each subcommand validates `toolId ∈ AI_TOOL_IDS` (reject IDE ids)
  - [ ] Each subcommand calls existing use-cases with `category: "ai"` filter or AI-tool-specific use-cases

### B. Create `aidd ide` parent command

- [ ] `src/application/commands/ide.ts`:
  - [ ] `registerIdeCommand(program)` — parent description "Manage IDE integrations (vscode)"
  - [ ] Subcommands: `install <tool>`, `uninstall <tool>`, `list`, `status`, `update [tool]`, `doctor`
  - [ ] No `sync`/`restore` on IDE (IDE configs are merge-based — sync semantics don't apply per locked decision; document in command help)
  - [ ] Each validates `toolId ∈ IDE_TOOL_IDS`

### C. Extend `aidd plugin`

- [ ] `src/application/commands/plugin.ts` — add subcommands:
  - [ ] `plugin status [--plugin <name>]` — calls existing `StatusUseCase` with `pluginName` filter
  - [ ] `plugin sync --source <tool> [--target <tool>]` — calls `SyncPluginsUseCase` (Phase 11 fully implements; here stub-wired)
  - [ ] `plugin restore --plugin <name>` — calls existing `RestorePluginUseCase` (cache-first per locked decision)
  - [ ] `plugin doctor [--plugin <name>]` — calls existing `DoctorUseCase` with `pluginName` filter

### D. Delete verb-first variants

- [ ] Delete `src/application/commands/install.ts` (verb-first flat)
- [ ] Delete `src/application/commands/uninstall.ts` (verb-first flat)
- [ ] Update `src/cli.ts`: remove `registerInstallCommand`, `registerUninstallCommand`; add `registerAiCommand`, `registerIdeCommand`
- [ ] Verb-first `update`, `restore`, `sync`, `status`, `doctor` STAY but become globals (Phase 10 makes them chain unitaries)

### E. Update use-case input contracts

- [ ] `InstallRuntimeConfigUseCase` already accepts single `toolId: AiToolId` — keep
- [ ] `InstallIdeConfigUseCase` already accepts single `toolId: IdeToolId` — keep
- [ ] `UninstallUseCase` accepts `toolIds: ToolId[]` — extract `UninstallAiUseCase` and `UninstallIdeUseCase` if logic diverges; otherwise reuse with category filter
- [ ] `SyncUseCase` accepts source/target — keep, restrict to AI category in `aidd ai sync` command
- [ ] `RestoreUseCase` accepts `toolIds` — keep, restrict to AI category in `aidd ai restore`

### F. Update `cli.ts`

- [ ] Remove imports: `registerInstallCommand`, `registerUninstallCommand`
- [ ] Add imports: `registerAiCommand`, `registerIdeCommand`
- [ ] Order of registration: `setup, ai, ide, plugin, marketplace, auth, sync, status, restore, update, doctor, clean, migrate, self-update`

## Tests (unit-first)

### Unit tests

- No new domain logic (just routing). Skip command-level unit tests.
- Use-case unit tests reused from existing suite.

### Integration tests

- [ ] `tests/application/commands/ai.integration.test.ts` — invoke `aidd ai install claude` via commander, verify use-case called with correct args
- [ ] `tests/application/commands/ide.integration.test.ts` — same for `aidd ide install vscode`
- [ ] Reject cross-category: `aidd ai install vscode` errors with clear message

### E2E tests

- One E2E in Phase 12 covering noun-first surface end-to-end

## Acceptance criteria

- [ ] `aidd install` exits with "unknown command"
- [ ] `aidd uninstall` exits with "unknown command"
- [ ] `aidd ai install claude` works
- [ ] `aidd ai install vscode` errors (vscode is IDE)
- [ ] `aidd ide install vscode` works
- [ ] `aidd ide install claude` errors
- [ ] `aidd ai --help`, `aidd ide --help`, `aidd plugin --help` all show subcommand list
- [ ] `aidd ai` (no subcommand, TTY) prompts subcommand picker
- [ ] `aidd ai status` works (filtered to AI tools)
- [ ] `aidd plugin sync --source claude` accepts but may stub-return (Phase 11 implements full)
- [ ] `pnpm typecheck` + `pnpm biome check` clean

## Manual validation

```bash
# Surface check
aidd --help | grep -E "^\s+(ai|ide|plugin|marketplace|auth)\b"
# expect: 5 noun-first parents

aidd ai --help     # expect: install, uninstall, list, status, update, sync, restore, doctor
aidd ide --help    # expect: install, uninstall, list, status, update, doctor
aidd plugin --help # expect: add, install, remove, list, update, search, pick, status, sync, restore, doctor

# Cross-category rejection
aidd ai install vscode 2>&1 | grep -i "must be ai" && echo "OK"
aidd ide install claude 2>&1 | grep -i "must be ide" && echo "OK"
```

## Risks / breaking changes

- **Major UX break** for users running `aidd install ai claude` — replace with `aidd ai install claude`. Document in CHANGELOG migration table.
- Shell completion scripts must update if shipped.
- No code aliasing the old verb-first form (clean break, no transition period).

## Commit

```
refactor(cli): noun-first command surface

Restructure domain commands under noun groups:
- aidd ai install/uninstall/list/status/update/sync/restore/doctor
- aidd ide install/uninstall/list/status/update/doctor
- aidd plugin status/sync/restore/doctor (extending existing add/install/list/update/search/pick/remove)

Delete verb-first flat variants:
- aidd install [category] [tool] (commands/install.ts)
- aidd uninstall [category] [tool] (commands/uninstall.ts)

Globals (status, doctor, sync, restore, update, clean, setup, migrate, self-update) stay flat — Phase 10 chains them.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-9.md
```
