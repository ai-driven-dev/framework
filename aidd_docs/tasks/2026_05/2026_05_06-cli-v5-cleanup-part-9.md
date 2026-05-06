# Phase 9 — Menu interactif aligned

> Refresh interactive menu (`aidd` no-arg in TTY) to reflect noun-first surface, drop dead entries, fix labels and ordering.

## Pre-requisites

- Phase 5 (noun-first surface) landed
- Phase 6 (globals chained) landed
- Phase 2 (suppressions) landed — `cache` and `config` commands gone
- Phase 7 (marketplace cache) landed — new `marketplace cache` entry

## Goal

Today the menu in `commands/menu.ts` references commands that no longer exist (cache, config legacy paths) and uses verb-first labels (e.g. "Install" → `["install"]` flat). Phase 9 rewrites the menu tree to dispatch noun-first commands and reorders branches by user intent.

## Architecture compliance

- Menu structure stays a pure data tree in `commands/menu.ts`
- `InteractiveMenuUseCase` already exists — keep, only the data tree changes
- Branch entries reference only existing commands (any reference to deleted commands fails type-checking via `spawnCliCommand` arg validation if added)

## Target menu tree

### Fresh project (no manifest)

```
1. Install AIDD in this project       → aidd setup
```

### Installed project

```
1. Inspect
   ├── Status                         → aidd status
   ├── Doctor                         → aidd doctor
   └── List installed
       ├── AI tools                   → aidd ai list
       ├── IDE tools                  → aidd ide list
       └── Plugins                    → aidd plugin list

2. Manage AI tools
   ├── Install                        → aidd ai install <prompt tool>
   ├── Uninstall                      → aidd ai uninstall <prompt tool>
   ├── Update                         → aidd ai update
   ├── Sync                           → aidd ai sync (interactive)
   ├── Restore                        → aidd ai restore
   └── Doctor                         → aidd ai doctor

3. Manage IDE tools
   ├── Install                        → aidd ide install <prompt tool>
   ├── Uninstall                      → aidd ide uninstall <prompt tool>
   ├── Update                         → aidd ide update
   └── Doctor                         → aidd ide doctor

4. Manage plugins
   ├── Install from marketplace       → aidd plugin install <prompt name>
   ├── Add local plugin               → aidd plugin add <prompt path>
   ├── Pick (interactive marketplace) → aidd plugin pick
   ├── Search                         → aidd plugin search <prompt query>
   ├── Update                         → aidd plugin update
   ├── Remove                         → aidd plugin remove <prompt name>
   ├── List                           → aidd plugin list
   ├── Sync                           → aidd plugin sync
   ├── Restore                        → aidd plugin restore
   └── Doctor                         → aidd plugin doctor

5. Marketplaces
   ├── List                           → aidd marketplace list
   ├── Add                            → aidd marketplace add
   ├── Browse                         → aidd marketplace browse <prompt name>
   ├── Refresh                        → aidd marketplace refresh
   ├── Remove                         → aidd marketplace remove <prompt name>
   ├── Check freshness                → aidd marketplace check
   └── Cache
       ├── List                       → aidd marketplace cache list
       └── Clear                      → aidd marketplace cache clear

6. Maintain & repair
   ├── Update everything              → aidd update
   ├── Sync everything                → aidd sync
   ├── Restore everything             → aidd restore
   └── Clean (nuke .aidd)             → aidd clean

7. Migrate from older version         → aidd migrate

8. System
   ├── Self-update CLI                → aidd self-update
   └── Authentication
       ├── Status                     → aidd auth status
       ├── Login                      → aidd auth login
       └── Logout                     → aidd auth logout
```

## Steps

- [ ] Rewrite `INSTALLED_NODES` constant in `commands/menu.ts` to the tree above
- [ ] Drop entries: `Cache (system)`, `Config (system)`, `Update (now under Maintain & repair)`, etc.
- [ ] Add `aidd ai list / ide list / plugin list` selectors under Inspect → List installed
- [ ] Update labels: drop "Pull the latest framework version" → use "Update everything" (no framework concept post-marketplace)
- [ ] Verify each leaf's `command: string[]` references a command that exists post Phases 2/5/6/7
- [ ] Update fresh project tree (`FRESH_NODES`) — only `setup` entry
- [ ] Update tests `tests/application/commands/menu*.test.ts`:
  - [ ] Verify menu tree matches expected structure (snapshot test)
  - [ ] Verify each `command` array is invokable (no unknown command after `aidd` parse)

## Tests (unit-first)

### Unit tests

- [ ] `tests/application/commands/menu.unit.test.ts`:
  - [ ] `InteractiveMenuUseCase.execute()` with no manifest → returns `setup` command
  - [ ] With manifest → returns selected command (test against mock `Prompter`)
  - [ ] Navigation back/exit handled
- [ ] Snapshot test of `INSTALLED_NODES` tree shape (order + labels) to catch unintentional drift

### Integration tests

- None (menu is pure data)

### E2E tests

- None (interactive flow not E2E-able without TTY pty harness — out of scope for cleanup)

## Acceptance criteria

- [ ] `aidd` (TTY, no manifest) → menu shows only "Install AIDD in this project"
- [ ] `aidd` (TTY, with manifest) → menu shows 8 top-level branches per target tree
- [ ] Every leaf invokes a real command (no "unknown command" errors)
- [ ] Snapshot test stable
- [ ] `pnpm typecheck` + `pnpm biome check` clean

## Manual validation

```bash
cd /tmp && rm -rf menu-fresh && mkdir menu-fresh && cd menu-fresh
aidd
# expect: single option "Install AIDD in this project"

cd /tmp/v5-globals    # installed project from earlier phases
aidd
# expect: 8 branches per tree above
# Navigate: Inspect → Status → expect aidd status output
# Navigate: Manage plugins → Pick → expect aidd plugin pick output
```

## Risks / breaking changes

- Menu UX is breaking for users who memorized prior structure. CHANGELOG must note.
- Snapshot test will require update on every legitimate menu change — accept this maintenance cost.

## Commit

```
refactor(menu): align with noun-first surface and v5 cleanup

Rewrite interactive menu tree to reflect post-cleanup command surface:
- Drop Cache and Config entries (commands deleted)
- Restructure under noun-first groups: Manage AI tools / IDE tools / plugins
- Add Inspect (status/doctor/list)
- Add Maintain & repair (chained globals)
- Move marketplace cache under Marketplaces
- Move auth under System

Snapshot test added on INSTALLED_NODES tree.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-9.md
```
