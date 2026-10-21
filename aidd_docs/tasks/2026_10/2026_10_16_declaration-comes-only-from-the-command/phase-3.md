---
status: done
---

# Phase 3: Contract, memory, plugin docs, gates

## Tasks

1. `aidd_docs/product/usage-contract.md`: store row, attribution rule, rename, legacy, limits, gate wording (M8).
2. `cli/aidd_docs/memory/telemetry.md`, `plugins/aidd-telemetry/README.md`, skill text where it describes declarations, `prompt-gate.cjs` header comment, fixture README.
3. Gates: `cd cli && pnpm test`, `pnpm test:mutation:telemetry` (under the lock), `node --test 'scripts/__tests__/*.test.js'`, bundle budget, `pnpm smoke`, `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` with and without `--attended`.
