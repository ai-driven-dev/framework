---
status: done
---

# Instruction: Docs, skill and gates

## Tasks

1. `aidd_docs/product/usage-contract.md` (person, opt-in), `cli/aidd_docs/memory/telemetry.md`, `plugins/aidd-telemetry/README.md`.
2. `plugins/aidd-telemetry/skills/00-init/actions/start.md`: explain and ask how the person appears (offer the git name, another id, or anonymous), then run `aidd telemetry on --yes --as <id>` or `--anonymous`; tests table updated.
3. Gates: `cd cli && pnpm test`; `pnpm test:mutation:telemetry` >= 96 with changed-line survivors explained; `pnpm smoke`; build + `node scripts/check-claude-tokens-end-to-end.cjs cli/dist/cli.js` and `--attended` (update the script for the new `on` flags if it calls `on --yes`); bundle budget; lefthook pre-commit and pre-push. Outputs in `evidence.md`.
