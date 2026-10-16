---
status: done
---

# Instruction: Docs, skill and gates

## Tasks

1. `aidd_docs/product/usage-contract.md` Report envelope: `filters`, the selection rules, the limits of the contract.
2. `cli/aidd_docs/memory/telemetry.md`: where filters live.
3. `plugins/aidd-telemetry/skills/01-usage/actions/frame.md`: a value fixed on one axis becomes a filter (`--task X --axis day`); two open axes still need one report per axis; reword step 3 and the "Tasks per day" test; add tests for a filtered question. `references/envelope.md`: `filters`.
4. Gates: `cd cli && pnpm test`; `pnpm test:mutation:telemetry` >= 96, survivors on changed lines explained; `pnpm smoke`; `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` and `--attended`; bundle budget; lefthook pre-commit and pre-push. Outputs in `evidence.md`.

## Acceptance

| Task | Criterion |
| ---- | --------- |
| 1-3 | grep finds `filters` and each flag in all three; checker agrees |
| 4 | every gate green, outputs recorded |
