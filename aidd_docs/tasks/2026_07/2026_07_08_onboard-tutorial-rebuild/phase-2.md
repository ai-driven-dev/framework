---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Scan action + state refs

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/00-onboard/
├── actions/
│   └── ✏️ 01-scan.md          # loads state/ refs conditionally, adds AI-tools detection
└── references/
    ├── ✅ state/zones.md       # the check catalogue per zone (from checks.md)
    ├── ✅ state/detection.md   # AI-tool roots + per-tool wiring status
    ├── ✅ state/done-rule.md   # session ledger / re-nag kill (from checks.md)
    ├── ✅ state/hedge.md       # plan-status build-to-ship pin (from checks.md)
    └── ❌ checks.md            # content split into state/ and order/ (order/ in phase 3)
```

## Tasks to do

### `1)` Carve the state references out of checks.md

> Tiny files, one concern each.

1. `state/zones.md`: the zone checks as a terse table (met/drift rule, deliverable, command, tier); keep the state-aware architecture rule (established => tech stack ✓, greenfield => ❌).
2. `state/detection.md`: roots `.claude .codex .cursor .opencode .github/copilot-instructions.md .github/{instructions,agents,skills,prompts}` => tool; per-tool wiring = its context file carries the memory block. Glyphs: `✓` used+wired · `⚠` used, not wired · `✗` required missing. Unused optional tools omitted.
3. `state/done-rule.md`: a step is done when disk proves it OR the session ledger recorded it run/left; 01 reads, 03 writes; no file.
4. `state/hedge.md`: plan `status:` => `in-progress` pins Build alone, `implemented`/open-PR pins Review-then-Ship, unreadable pins Build-then-Review.

### `2)` Rewrite 01-scan to load state refs conditionally

> Pay only for what the scan needs.

1. Load `state/zones.md` and `state/detection.md` every scan; `state/hedge.md` only when a plan exists; re-read `state/done-rule.md`'s ledger every scan.
2. Add the detection step: resolve each AI-tool root to a tool and its wiring status.
3. Keep cross-branch scoping: only the current branch's PR sets the dev-flow pin.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                           |
| ---- | -------------------------------------------------------------------------------------------- |
| 1    | Each `state/*.md` holds exactly one concern and no `@`-chain to another reference.            |
| 2    | The snapshot carries per-tool detection (`✓/⚠/✗`) with unused tools absent, not crossed.     |
| 2    | A plan `status: in-progress` yields Build-alone; a repo-wide PR on another branch sets no pin. |
| 2    | A step recorded in the session ledger is absent from the next scan's actionable set.          |
