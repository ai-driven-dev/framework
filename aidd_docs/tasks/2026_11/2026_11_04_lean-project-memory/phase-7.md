---
status: pending
---

# Instruction: CLI harness: guards that refuse what the hook refactor removes

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── lefthook.yml ✏️
└── cli/
    ├── biome.json ✏️
    ├── package.json ✏️
    └── tests/architecture/
        ├── biome-guards-bite.arch.test.ts ✏️
        ├── ports-are-called.arch.test.ts ✏️
        └── tool-hooks-one-descriptor.arch.test.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | count, at the base head, the domain files importing `kernel/ports/file-reader` or `file-writer`, and the capability methods with no caller | the baseline, each entry with its reason | system |
| Happy path | each new guard run on the tree | passes with its baseline | system |
| Edge case | a planted domain file importing `file-writer` | biome refuses it, proven in `biome-guards-bite.arch.test.ts` | system |
| Edge case | a planted capability method nobody calls | the extended `ports-are-called` fails naming it | system |
| Edge case | a planted second hooks fact on a tool, outside its descriptor | `tool-hooks-one-descriptor` fails naming the tool | system |
| Edge case | a block copied between two profiles | the profile-scoped copy check fails before push | system |

## Tasks to do

### `1)` Domain does no I/O

> The rule `0-hexagonal.md` states, enforced by the mechanism the repository already uses.

1. Planted violation first, in `biome-guards-bite.arch.test.ts`.
2. Check first whether biome's `noRestrictedImports` catches an `import type`; `build-contract.ts` imports the ports as types only. If it does not, the guard is an arch test instead.
3. Forbid `kernel/ports/file-reader` and `kernel/ports/file-writer` in each context's `domain/**`, `domain/ports/` excepted; the files importing them today go in an arch-test `BASELINE` through `expectRatchet`, with a count and a reason each, so a drop must be recorded and a new import fails.

### `2)` A declared behaviour has a caller

> `HooksCapability.merge` survived with no caller; nothing saw it.

1. Planted capability method with no caller first.
2. Extend `ports-are-called.arch.test.ts` from ports to capability classes; baseline `HooksCapability.merge` and any other hit.

### `3)` One hooks fact per tool

> A tool's hook behaviour is read from one place.

1. Planted second declaration first.
2. `tool-hooks-one-descriptor.arch.test.ts`: under `profiles/<tool>/`, only the hooks descriptor declares destination, event map, entry shape or bridge; `build.ts`'s `hooksBridge` and `profile.ts`'s `flatHooksBridge` start in the baseline.

### `4)` Copies seen before push

> jscpd runs only in CI, over all of `src/` at 3.3 %, so a copy between two profiles hides in the average.

1. Run jscpd once over `src/contexts/tools/domain/profiles/` and read what it flags: declarative data that only looks alike is not a copy. Set the `jscpd:profiles` script's minimum block size and threshold from that run, and run it in the pre-push.
2. Baseline today's copies by file pair; each leaves when phase 10 or 11 removes it.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1-4 | each guard fails on its planted violation and passes on the tree with its baseline; every baseline entry names a count and a reason; `pnpm test:arch`, `pnpm lint` and the pre-push pass |
