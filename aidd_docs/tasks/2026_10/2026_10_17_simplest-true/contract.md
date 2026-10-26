---
status: implemented
---

# Simplest, deterministic, true

## Need

Follows the R1 telemetry audit. The maintainer's rule: the simplest design that stays deterministic and true. Write no code for a case never observed in real data; prefer deleting code, or stating a limit, over adding a mechanism; no exemptions in properties.

## Scope, as handed over

1. **A call without a `requestId` is left out, and said.** Not stored; counted in `left_out` under its own reason, `requestless`; a consenting clone keeps only its hash, as `undated` does. One predicate at every entry point: transcript ingest, the migration of stored lines, lines an older CLI (cli-v5.5.0) writes after the upgrade. Removed: `isKeyedBySession`, the full-ledger read in `storeCalls`, the second bound in `report/period.ts`, the older-CLI limit rows, the window property's exemption, the tests that existed only for them.
2. **The local-path guard is line-based only.** No array pass, no 64 KB cap, no offset-to-line search, no sort. Patterns, dash slug, session key, session-file name, placeholder-id rule and allowlist kept. Multi-line structures are not parsed.
3. **The process rules are written once**, merged into an existing rule.

## Acceptance, as handed over

- Measured first: the Claude Code versions the local transcripts span, and how many usage lines lack `requestId`. Aggregates only.
- With zero exemptions, under generators holding requestless lines, legacy keys and older-CLI lines after the migration: (a) a bounded read equals the full one filtered; (b) a migrated store equals one fresh ingest, byte for byte.
- `node scripts/check-no-local-paths.js --all` reports 0; the old `phase-5.md:54` line still fails.
- Net lines removed exceed lines added. Bundle reported.
