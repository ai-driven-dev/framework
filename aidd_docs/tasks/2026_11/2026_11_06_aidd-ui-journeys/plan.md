---
objective: "From a persona, the person gets journeys and a wireframe for each screen they cross, without style, checked without AI."
status: approved
---

# Plan: aidd-ui journeys and wireframes

Source: [spec.md](./spec.md)

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Engine: wireframe kind, journey and render rules | [`phase-1.md`](./phase-1.md) | none |
| 2   | Skill `02-journeys`, from scratch with brand and tokens first | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Docs and pilots | [`phase-3.md`](./phase-3.md) | 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | none |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| regression | medium: R2's fix text, R12, V1, V2, `bump --change` and the impact report change; `records.test.js` (R12 at 309, R2 text at 706), `impact.test.js` (deepEqual reports at 49, 139, 206, 235), `bump.test.js` and `skill.test.js` ("only skill" at 213) cover them; the fixture journey gains `## Persona`; the existing suite is the safety net, no separate phase | 1, 2 |
| architecture | one more kind in `model.cjs` `FOLDER_KINDS`; ids stay unique across all records; `bump --change` raises reached wireframes (`bump.cjs:141` reads elements and screens only) | 1 |
| runtime | `claude -p --model haiku` on scratchpad copies: an empty folder for the breathing app, `git archive origin/main` of Gouvernail and of Kairos, sources read-only; no source has `aidd_docs/ui`; unverified until run | 3 |
| documentation | README (skills, start, diagram), `plugin.json` description, global spec (tree, records table), `01-system` cases and engine reference (impact keys); catalogs regenerate on commit | 2, 3 |

## Rules

| Rule | Why it applies |
| --- | --- |
| test first, each guard with the mutation that turns its own test red | every new rule is a guard |
| no code for an input never observed | wireframe shapes come from the pilots, not guesses |
| a skill never names another skill | `02-journeys` and `01-system` point by purpose |
| a skill never links outside itself | `02-journeys` carries its own engine lines |
| no dates or ticket ids in code or docs | applies to every file written |
| scripts suite always wrapped | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` |

## Decisions

| Decision | Why |
| --- | --- |
| A wireframe has its own id; a step names a screen or a wireframe | ids are unique across records, and history, `bump`, impact, R4 and R6 key by them |
| A wireframe is no element: `uses` names expected components, an unknown one warns | a wireframe comes before the components it expects |
| A wireframe stays `proposed` in this PR: `publish`, H6 and H8 keep to elements | its review comes with the screens; widening them now would ship a path nothing uses |
| A wireframe render holds no style at all: no `<style>`, `style=`, `<link>` or `var()` | V4 and V6 miss named colours, `%` and fonts, and point to tokens a wireframe must not hold |
| A step keeps the `Screen` column, naming a screen or a wireframe | R12 and impact already read it; a screen cites its wireframe only with the screens |
