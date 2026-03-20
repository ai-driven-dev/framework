---
name: interactive-mode-part-4-review
date: 2026-03-19
---

# Code Review: Interactive Mode — Part 4

## Verdict: PASS (after fixes)

Two issues were found and fixed before this review was saved. All assertions pass.

---

## Part A: Coding Assertions

| Assertion | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm knip:production` | PASS |
| `pnpm jscpd` | PASS (27 clones, all pre-existing) |
| `pnpm test` | PASS — 748/748 (1 pre-existing flaky timeout in `status.e2e.test.ts` under concurrent load, passes in isolation) |

---

## Part B: Code Review

### Files reviewed

- `src/application/commands/update.ts`
- `src/application/commands/restore.ts`
- `src/application/commands/sync.ts`
- `src/application/commands/cache.ts`
- All `.claude/rules/` files

---

### Issue 1 — CRITICAL (Fixed): `cache.ts` imports infrastructure adapters directly

**File**: `src/application/commands/cache.ts`

**Rule violated**: Hexagonal architecture — "Application imports ports, not adapters."

**What was wrong**: `InquirerPrompterAdapter` and `SilentPrompterAdapter` (infrastructure layer) were imported directly in the application command. This breaks the dependency inversion rule. Additionally, the ternary `process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter()` was unreachable dead code — it appeared after an explicit `if (!process.stdout.isTTY) { ... process.exit(1); }` guard, making the `SilentPrompterAdapter` branch impossible.

**Fix applied**: Replaced the direct adapter imports with a `createDeps()` call to get the properly wired `deps.prompter`. The `createDeps()` function in `deps.ts` already handles the TTY check and returns the correct prompter (Inquirer in TTY, Silent otherwise), eliminating the redundant ternary.

```diff
- import {
-   InquirerPrompterAdapter,
-   SilentPrompterAdapter,
- } from "../../infrastructure/adapters/prompter-adapter.js";
+ import { createDeps } from "../../infrastructure/deps.js";

- const prompter = process.stdout.isTTY
-   ? new InquirerPrompterAdapter()
-   : new SilentPrompterAdapter();
+ const deps = await createDeps(projectRoot, { verbose }, output);

- await prompter.checkbox(...)
+ await deps.prompter.checkbox(...)
```

---

### Issue 2 — MINOR (Fixed): `update.ts` instantiates `UpdateUseCase` twice

**File**: `src/application/commands/update.ts`

**Rule violated**: DRY — "Extract private helper when >= 2 callers share identical logic."

**What was wrong**: `ConflictResolutionUseCase` and `UpdateUseCase` were instantiated identically at two points in the action handler: once inside the `if (isInteractive)` block for the dry-run preview, and again after the block for the actual execution. Same constructor arguments, same dependencies.

**Fix applied**: Hoisted both instantiations to before the `isInteractive` block. The same `updateUseCase` instance is reused for both the dry-run call and the final execution call.

```diff
+ const conflictResolution = new ConflictResolutionUseCase(deps.prompter);
+ const updateUseCase = new UpdateUseCase(deps.fs, deps.manifestRepo, ...);

  if (isInteractive) {
-   const conflictResolution = new ConflictResolutionUseCase(deps.prompter);
-   const updateUseCase = new UpdateUseCase(deps.fs, deps.manifestRepo, ...);
    const dryRunResult = await updateUseCase.execute({ dryRun: true, ... });
    ...
  }

- const conflictResolution = new ConflictResolutionUseCase(deps.prompter);
- const updateUseCase = new UpdateUseCase(deps.fs, deps.manifestRepo, ...);
  const result = await updateUseCase.execute({ ... });
```

---

### Observations (no action required)

#### Hexagonal architecture — update.ts, restore.ts, sync.ts

All three commands correctly import only from `application/` and `domain/` layers (via `createDeps`). No direct infrastructure adapter imports outside `cache.ts` (now fixed).

#### Single responsibility — interactive blocks

The interactive block in each command is clearly delineated with an `isInteractive` flag computed once from the TTY + flag state, then a single `if (isInteractive)` block that resolves prompts into existing option variables. The pattern is consistent with Parts 1-3.

#### TTY guard consistency

All four commands follow the same TTY guard pattern established in Parts 1-3:
- `restore.ts`: `if (!cmdOptions.force && !process.stdout.isTTY)` + then `isInteractive` for the interactive path
- `sync.ts`: missing `--source` triggers `if (!process.stdout.isTTY)` guard before interactive path
- `cache.ts`: missing version/--all triggers `if (!process.stdout.isTTY)` guard before interactive path
- `update.ts`: `isInteractive` flag guards the preview + prompt block; non-TTY falls through to existing behavior (correct per the spec: "If not TTY → fall through to existing behavior")

This is correct and consistent.

#### restore.ts — StatusUseCase instantiated inline

`StatusUseCase` is constructed inline in `restore.ts` with `deps.fs`, `deps.manifestRepo`, and `deps.logger`. This is correct: `StatusUseCase` requires no resolver (no network call), only file system and manifest reads. The framework path/version are not needed because the status check only inspects disk state against the manifest's stored hashes — no framework download occurs.

#### update.ts — dry-run → display → confirm → execute flow

The flow matches the spec: dry-run first (to get diff counts), display version info, scope select, confirm, then execute with the resolved scope. The `resolvedForce = true` after confirm is intentional — once the user confirmed in interactive mode, the execution should not re-prompt for conflicts.

One observation: after confirm=true, the scope mapping for "all" leaves `resolvedToolId` and `resolvedDocsOnly` at their initial values (undefined/false), which correctly maps to the full update. No issue.

#### sync.ts — --source changed from requiredOption to option

`--source` is correctly `.option()` (not `.requiredOption()`), allowing the interactive path to handle the missing case. The non-TTY guard (`if (!process.stdout.isTTY)`) is present and correct. Validation of the `--source` value against `VALID_TOOL_IDS` only runs in the non-interactive branch where `cmdOptions.source` is defined — this is correct.

#### jscpd — remaining 27 clones

All 27 remaining jscpd clones are pre-existing:
- Cross-command boilerplate: `globalOptions` extraction, `createDeps` call, `output`/`projectRoot` setup — unavoidable structural repetition across all command files
- Internal `update-use-case.ts` clones: pre-existing iteration patterns
- Domain tool clones: pre-existing per-tool handler patterns

None were introduced by Part 4. The fix to `update.ts` eliminated the `UpdateUseCase` double-instantiation clone that jscpd was previously reporting at lines 187/178.

---

## Summary of fixes

| # | File | Severity | Description |
| --- | --- | --- | --- |
| 1 | `cache.ts` | Critical | Removed direct imports of `InquirerPrompterAdapter`/`SilentPrompterAdapter`; replaced with `createDeps` to get `deps.prompter` |
| 2 | `cache.ts` | Minor | Removed unreachable `SilentPrompterAdapter` branch (dead code after `process.exit(1)` guard) |
| 3 | `update.ts` | Minor | Hoisted `UpdateUseCase`/`ConflictResolutionUseCase` instantiation to eliminate duplication |
