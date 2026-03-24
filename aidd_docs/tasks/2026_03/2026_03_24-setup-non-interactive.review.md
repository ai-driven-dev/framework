---
name: code-review
description: Code review for setup non-interactive mode
argument-hint: N/A
---

# Code Review for setup non-interactive mode

Adds flags `--docs-dir`, `--tools`, `--all-tools`, `--from` to `aidd setup` and removes the TTY hard-block, enabling CI/CD and script usage without a terminal.

- Status: ⚠️ needs minor fixes
- Confidence: 8/10

---

- [Main expected Changes](#main-expected-changes)
- [Scoring](#scoring)
- [Code Quality Checklist](#code-quality-checklist)
- [Final Review](#final-review)

## Main expected Changes

- [x] TTY hard-block removed from setup.ts
- [x] `--docs-dir`, `--tools`, `--all-tools`, `--from` flags added
- [x] `interactive: process.stdout.isTTY` passed to use-case
- [x] Non-interactive guards per branch (handleInit, handleAdopt, handleUpdate, offerAdditionalInstall, handleUpToDate)
- [x] E2E test updated
- [x] Unit tests added

## Scoring

- [🟡] **CLI flag validation placement** `setup.ts:54-61` `assertValidToolIds` is inside `try/catch` but per `0-command-thin-wrapper.md`, CLI flag validation must be **before** `try/catch` using `output.error()` + `process.exit(1)`. The `catch` swallows it via `output.exit(error)` which is acceptable but inconsistent with the rule. (move before try, add explicit `output.error()` + `process.exit(1)`)
- [🟡] **DRY violation** `setup-use-case.ts:144-168` The non-interactive branch for source resolution duplicates `manifestRepo.load()` + default-source resolution logic verbatim from the interactive `else` branch. Only the prompt call differs. (extract `const sourceDefault = (await this.manifestRepo.load())?.repo ?? this.resolver.getDefaultRepo() ?? ""` before the if/else, share it)
- [🟡] **Test names use internal method names** `setup-use-case.test.ts:51,68` Names `"handleAdopt non-interactive..."` and `"handleUpToDate non-interactive..."` violate rule `5-testing.md`: "Test names describe user-visible scenarios, not method names." (rename to e.g. `"adopt state, non-interactive, no --tools → throws"` and `"up-to-date project, non-interactive → skips additional install prompt"`)
- [🟢] Command description still says "Interactively set up..." — minor but misleading after this change. (update to "Set up or update the project")

## Code Quality Checklist

### Potentially Unnecessary Elements

- [🟢] No dead code introduced

### Standards Compliance

- [🟢] Named exports only — respected
- [🟢] No barrel files — respected
- [🟢] `import type` used where applicable (CLIOutput now `import type`)
- [🟡] CLI flag validation inside try/catch (see Scoring)

### Architecture

- [🟢] Hexagonal architecture respected — no layer violations
- [🟢] Command calls exactly one use-case
- [🟢] `interactive` flag flows correctly from command → use-case → nested use-cases
- [🟢] `offerAdditionalInstall` correctly receives `interactive` param

### Code Health

- [🟡] DRY: source resolution duplicated in `handleInit` (see Scoring)
- [🟢] Guard clauses pattern respected in use-case (early returns added correctly)
- [🟢] No magic strings/numbers introduced
- [🟢] `?? false` fallback on `interactive` is correct and safe

### Security

- [🟢] No new attack surface — flag values validated before use

### Error management

- [🟢] `AdoptRequiresVersionError` reused correctly for `--from` missing case
- [🟢] All non-interactive throws are caught by `output.exit(error)` in command
- [🟢] Use-cases throw, commands catch — rule respected

### Performance

- [🟢] No regressions

### Backend specific

#### Logging

- [🟢] No missing log calls

## Final Review

- **Score**: 7.5/10
- **Feedback**: Feature is functionally correct and well-structured. Three minor rule violations to fix before merging: move `assertValidToolIds` before `try/catch`, deduplicate manifest load in `handleInit`, and rename unit test cases to behavioral names.
- **Follow-up Actions**:
  1. Move `assertValidToolIds` guard before `try/catch` in `setup.ts` with `output.error()` + `process.exit(1)`
  2. Extract manifest load + default source resolution in `handleInit` to a shared variable before the if/else
  3. Rename unit test cases to behavioral descriptions (no method names)
  4. Update command `.description()` to remove the word "Interactively"
- **Additional Notes**: The `--tools` flag using comma-separated values instead of positional args (like `install`) is a deliberate choice given `setup` has no other positional params — it's consistent with the command's multi-concern nature. Acceptable.
