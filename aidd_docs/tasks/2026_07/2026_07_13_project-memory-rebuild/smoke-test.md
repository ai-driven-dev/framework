# Smoke test — the reworked skill

Ten fixtures, both hosts synced to this branch first (`dev-sync.sh`). Every claim read off disk, never off a report. `smoke-setup.sh` and `smoke-assert.sh` in the job tmp.

| # | Fixture | Host | Proves | Result |
| - | ------- | ---- | ------ | ------ |
| F1 | greenfield | Claude | scan Ground stops, writes nothing | pass |
| F2 | existing + code | Claude | full flow, flat memory, no placeholder, block filled, hand line kept, unpicked tool untouched, nothing staged | pass |
| F3 | existing, bare AGENTS | Codex | full flow, section+block inserted, hand line kept | pass |
| F4 | memory + claude, add codex | Claude | sync alone wires codex, claude stays wired, memory byte-identical | pass |
| F5 | no memory | Claude | sync Require stops before writing | pass |
| F6 | architecture missing a section | Claude | drift reported, never injected | pass |
| F7 | dropped capability | Claude | generate ran, Prune flagged and offered removal, declined, kept | pass |
| F8 | shared AGENTS (codex+cursor) | Codex | pick codex wires the shared file once | pass |
| F9 | context file on old template | Claude | reconcile offered vs the asset, nothing applied without an answer | pass |
| F10 | auth + deployment | Claude | gated mermaids filled, no TODO left in any diagram | pass |

Disk assertions: 31 pass, 0 fail.

## Two re-runs

- **F7** first stalled at the confirmation gate (the prompt said "confirm" without "proceed"). Re-run with "and proceed": generate ran, created the four missing core files, Prune flagged `api`/`database`, offered removal, kept both on the decline. The flag-offer-consent path is proven.
- **F9** first did not offer: the block already matched so sync short-circuited, and "seeded from an older template" was too vague to detect. Fixed the sync instruction to "if its AIDD structure differs from `@../assets/AGENTS.md`, offer to reconcile". Re-run: it detected the missing `## Behavior/Communication/Action` sections and the stray `OLD-INSTRUCTION` line, and offered options. Nothing applied without an answer.

## Review, by host — the one asymmetry

- **Claude fans out for real.** F2: nine independent `aidd-dev:checker` reviewers, one per file; they flagged stub-overstatement and cross-file duplication, and the fixes were applied. F10: four parallel checkers. The prerogative is met.
- **Codex self-passes.** F3 (twice): "ran without subagents, one fresh pass per memory file; no fixes needed." `codex exec` headless does not spawn real subagents. An earlier Codex run that named reviewers (Peirce, Singer, Darwin, ...) was one pass role-playing personas, not real fan-out. The skill degrades as designed and says so, but Codex gets a self-review, not an independent one.

Content and structure are sound on both hosts. The independent review is real only on Claude. Whether the Codex self-pass is acceptable, or independent review is a hard requirement on every host, is a product decision.

## Still not proven

- **Accepting a Prune removal or a reconcile.** Headless can offer but cannot answer, so only the decline path is proven. Accepting is manual.
