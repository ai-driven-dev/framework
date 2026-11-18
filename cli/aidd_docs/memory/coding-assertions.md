# Coding Assertions

What must be green for `cli/` code to count as done. The repository's own gates are in [`aidd_docs/memory/coding-assertions.md`](../../../aidd_docs/memory/coding-assertions.md).

## Before commit

| Command | Checks |
| --- | --- |
| `pnpm lint` | biome with the GritQL plugins under `biome-plugins/`, warnings as errors |
| `pnpm test:arch` | the architecture ratchets |
| `pnpm typecheck` | `tsc --noEmit` |
| `node scripts/check-cli-type-honesty.mjs` | no type widened through `unknown`, `any` or `never`; run from the repository root |

## Before push

| Command | Checks |
| --- | --- |
| `pnpm knip` | dead code, unused exports |
| `pnpm jscpd:profiles` | a block copied between tool profiles, against its baseline |
| `pnpm test` | every vitest project |

## In CI only

| Command | Checks |
| --- | --- |
| `pnpm test:coverage`, `pnpm smoke`, `pnpm build`, `pnpm jscpd` | thresholds, built binary, bundle budget, duplication |
| `cli-mutation` | per-scope floors: [`testing.md`](testing.md) |

- Every job fans into the required check `cli / gate` (`.github/workflows/cli-ci.yml`).
- Test first, and see it fail for the reason it names: [`cli-tests.md`](../../.claude/rules/cli-tests.md).
