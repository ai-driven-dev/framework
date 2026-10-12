# Implementation verification

Verified on 2026-10-08 in the working tree. No commit, push, staging or independent review was performed by the implementation agent.

## Delivered behavior

The OpenCode profile declares publication into a signed, bounded `AGENTS.md` contribution. Its pure formatter preserves bytes outside that contribution, including project memory. Framework publication reads editable Markdown sources, validates prospective source writes/removals and existing ownership before mutation, and uses the existing realpath boundary guard. The command works without a manifest:

```sh
aidd framework rules --tool opencode --publish
aidd framework rules --tool opencode --write .opencode/rules/01-standards/1-rule.md --from /tmp/staged-rule.md
aidd framework rules --tool opencode --delete .opencode/rules/01-standards/1-rule.md
```

Install, update, restore, fallback plugin materialization, removal and clean share the publication operation. `AGENTS.md` is not registered as an owned file. Untracked rule sources remain active when installed sources are removed. The bundled config retains its schema and drops its inert rule glob; direct publication preserves existing JSON/JSONC bytes. Generator and exploration documentation now distinguish sources from active V2 guidance.

## Test-first evidence

- The formatter and publication tests initially failed because their production modules did not exist.
- The installation regression failed with `expected 'User instructions\r\n' to contain 'Installed rule text'` and `promise resolved ... instead of rejecting`. It then passed after publication and ownership preflight were connected.
- The built CLI regression exposed missing-directory handling with `ENOENT ... scandir ... .opencode/rules/`; it passed after an absent source directory was treated as an empty set.
- Planted edited, duplicate and incomplete contributions, reserved markers, incomplete frontmatter, NUL text, unbalanced fences and an external rule-directory symlink prove refusal before source or instruction mutation. Fenced marker examples remain repeatable.

## Final checks

- `pnpm --dir cli lint`: exit 0, 1018 files checked. One existing warning in unchanged `uninstall-use-case.ts` about its unused private filesystem member remains.
- `pnpm --dir cli typecheck`: exit 0.
- `node scripts/check-cli-type-honesty.mjs`: no widening or compiler-silencing directive.
- `pnpm --dir cli knip`: exit 0.
- `pnpm --dir cli test:arch`: 27 files, 142 tests passed. No ratchet or baseline was relaxed.
- `pnpm --dir cli test`: 538 files passed, 6870 tests passed; one existing conditional Kilo runtime test skipped because `KILO_RUNTIME_SMOKE` was not enabled. OpenCode's required real-host proof was run separately by the parent.
- `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`: 554 passed, zero failed/skipped.
- Root architecture, context imports, reference form, referenced paths, documentation duplication, Markdown links, argument hints and changed JSON validation: exit 0. `git diff --check`: clean.
- `pnpm --dir cli build`: `OK: within budget`, measured 744.10 KB against 750 KB. Isolated HEAD measured 733.98 KB. The recorded increase is 10.12 KB, with 0.79% headroom and no new runtime dependency.

The first full CLI sweep identified expected help/config snapshot drift and obsolete config assertions, plus a current-version runtime-helper backfill regression. All were repaired; targeted checks and the final full sweep passed. Golden changes are limited to the rules command help and the OpenCode config digest.

## Runtime and limits

The parent's [runtime verification](verification.md) and retained `runtime-results.json` record five actual OpenCode V2 2.0.22 journeys against local inference: baseline, publication, direct staged generation, source update and last-source deletion. Exact active rule text and user guidance reached model input; the instructions-only marker stayed absent. Runtime coverage is macOS arm64 only. V1, native per-rule glob filtering and flat archive rule distribution remain outside this delivery.

Individual filesystem writes use the existing port; this operation preflights unsafe state, but does not introduce a transaction or rollback for subsequent filesystem I/O failure. Independent Check remains the parent's responsibility.

## Repairs after independent Check

The checker requested F1 and F2 repairs. Both were reproduced with new tests before changing production code.

- F1: a real filesystem and persisted manifest test with an unavailable catalogue showed two prior plugin files disappearing after an unsafe replacement was rejected. The same unsafe canonical input was accepted with a resolved catalogue. Replacement now preflights the complete old-to-prospective source transition before deletion or manifest mutation, deletes without intermediate publication, and then publishes from actually materialized files. Three integration cases prove unchanged old rule/agent/config/instruction/manifest bytes on refusal, and prove a safe canonical rule skipped by a resolved build never becomes active. The source preflight is conservative: unsafe canonical rule inputs can be rejected even when a resolved build would skip them. This limitation is stated in the CLI reference.
- F2: two formatter cases, a prospective publication case and a built CLI case initially accepted markers exposed by stripping YAML frontmatter. Validation now scans the parsed body and rendered scope instructions, and revalidates the complete composed contribution before any write. The first staged write refuses the exact checker witness with unchanged sources and user guidance. Existing genuinely fenced body examples still pass and remain idempotent. Ordinary rendered bytes and command procedure are unchanged.

The repaired targeted suite passed 26 tests. The final full CLI sweep passed 6870 tests across 538 files, with the same existing conditional Kilo skip; architecture passed 142 tests and scripts passed 554. Lint, typecheck, knip, type honesty, root guards and the 744.10 KB build passed. One initial lint sweep encountered a temporary hook-test probe created concurrently by the scripts suite; rerunning after that suite cleaned up passed with only the unchanged private-member warning. No independent assessment was performed by the repair agent. The candidate is ready for the same checker's re-Check.
