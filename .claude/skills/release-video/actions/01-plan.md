# 01 - Plan

Cover every feature shipped since the last release with one scene, or one written reason.

## Input

The repository at the release candidate.

## Output

`aidd_docs/release-video/scenes.json` that `node scripts/check-release-video.js` accepts; the next step is [render](02-render.md).

## Process

1. **List.** Run `node scripts/check-release-video.js`. Each surface under "Scènes manquantes" needs a scene or a skip.
2. **Read.** Open the skill or command each surface names; take its real behavior, never a guess.
3. **Draft.** Fill the [plan template](../assets/scenes-template.json): one scene per surface, a template from the list below, a short title, example values marked as examples.
4. **Skip.** Move a surface to `skipped` with a reason only when a user would not notice it.
5. **Check.** Rerun the script until it passes, then show the plan and fold corrections.

| Template | Fits |
| --- | --- |
| `terminal-demo` | one command and its output |
| `two-panels` | a request beside its result |
| `bullet-grid` | several small changes |
| `contributors` | who shipped the release |
| `outro` | version and install command |

## Test

| Case | Pass |
| --- | --- |
| Uncovered feature | script names it; plan gains a scene or a skip |
| Skip without reason | script fails; reason added |
| Release with no `feat:` commit | no video; plan left empty |
| Invented demo value | marked as an example in the scene |
