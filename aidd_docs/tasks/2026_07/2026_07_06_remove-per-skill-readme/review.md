# Review: Remove per-skill README.md

- **Verdict**: approve
- **Diff**: `484928c...9b327eb`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_06
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

### Phase 1 — Remove READMEs, fix all refs

- [x] Task 1: each outlier's unique content merged into SKILL.md or confirmed a pure mirror — 00-onboard/SKILL.md:36 (Requires folded), 01-hello/SKILL.md:19-21 (prereq folded), 00-repo-init/SKILL.md:9,30-33 (status + prereq folded); 09-mermaid/10-learn/11-explore/12-cook confirmed pure mirrors (prereq already in SKILL.md)
- [x] Task 2: no direct-child `skills/*/README.md` remains; both asset READMEs present — direct-child loop returns nothing; `plugins/aidd-context/skills/02-project-memory/assets/README.md` + `.../assets/templates/memory/README.md` intact
- [x] Task 3: no `plugins/*/README.md` skill table links to `skills/*/README.md`; all point to SKILL.md — grep of `plugins/*/README.md` returns none; aidd-orchestrator/README.md:19,21 retargeted
- [x] Task 4: `docs/CREATE_PLUGIN.md` no longer prescribes a per-skill README, links to no removed file — docs/CREATE_PLUGIN.md:41,94 (structure line + section removed)
- [x] Task 5: regenerated CATALOG.md files list no `skills/*/README.md` row — grep returns only the retained asset README row (aidd-context/CATALOG.md:81), not a per-skill mirror

### Phase 2 — Verify and guard

- [x] Task 1: `node scripts/check-markdown-links.js` exits 0, no dangling README link — "Links: 0 broken in 364 files", exit 0
- [x] Task 2: zero direct-child `skills/*/README.md`; every affected skill dir keeps SKILL.md; asset READMEs intact — orphan loop returns nothing; asset READMEs present
- [x] Task 3: `sync-readme-counts.mjs --check` exits 0; no CATALOG lists a per-skill README — exit 0; CATALOG regen produced zero drift (proves generated, not hand-edited)
- [x] Task 4: skill generator emits no per-skill README — `grep -rniE readme plugins/aidd-context/skills/04-skill-generate/` returns nothing; templates scaffold SKILL.md + actions only

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | plugins/aidd-context/skills/09-mermaid/SKILL.md | Deleted README's `## Requires` elaborated the input as "a paragraph, a list, or a section"; SKILL.md keeps the essential "written source" (description + Actions input) but drops that parenthetical granularity. Judged a pure mirror; noted for completeness. | Optional: none required — essential prerequisite is preserved. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (9/9)                                         |
| Files checked | 39 deleted skill READMEs, 7 plugin READMEs, 7 CATALOG.md, 3 SKILL.md merges (00-onboard, 01-hello, 00-repo-init), docs/CREATE_PLUGIN.md, plugins/aidd-context/skills/04-skill-generate/* |
| Unchecked     | none |
| Unplanned     | none (60 files = 39 deletions + 3 plan docs added + 18 modified; exactly scoped, no creep) |
