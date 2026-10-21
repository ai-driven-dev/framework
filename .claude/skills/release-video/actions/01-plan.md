# 01 - Plan

Cover every feature shipped since the last release with one scene, or one written reason.

## Input

The repository at the release candidate.

## Output

`aidd_docs/release-video/scenes.json` that `node scripts/check-release-video.js` accepts; the next step is [render](02-render.md).

## Process

1. **List.** Run `node scripts/check-release-video.js`. Each surface under "Scènes manquantes" needs a scene or a skip.
2. **Read.** Open the skill or command each surface names; take its real behavior, never a guess.
3. **Draft.** Fill the [plan template](../assets/scenes-template.json): one scene per surface, a template from the list below, a short title, example values marked as examples. Each scene has a `lead`: one plain sentence saying what it does for the user and why it matters. A viewer who never read the release notes must understand it from the lead alone; no internal names, no jargon. The check refuses a lead over 14 words.
4. **Skip.** Move a surface to `skipped` with a reason only when a user would not notice it.
5. **Fixes.** List the `fix:` commits since the last release tag. Group the ones a user would notice into one `bullet-grid` scene: the title says what was broken, the detail names who reported it when an issue exists. No scene when none qualifies.
6. **Contributors.** Name who shipped the release with `gh api repos/{owner}/{repo}/compare/<last-tag>...next --jq '[.commits[].author.login] | unique'`. Drop bots. Put the logins in one `contributors` scene, last.
7. **Intro.** Fill `intro` so that someone who never used AIDD wants to know more, in a glance. The `tagline` is a hook of six words at most: the pain the release removes or its one big news, never the name of a feature. Add up to three `highlights` of three words at most, each starting from what the user gets. Take the facts from the release announcement, so the video and the message say the same thing. The check refuses longer text. Read it aloud: if it could open any release, rewrite it.
8. **Check.** Rerun the script until it passes, then show the plan and fold corrections.

| Template | Fits |
| --- | --- |
| `terminal-demo` | one command and its output |
| `two-panels` | a request beside its result |
| `bullet-grid` | several small changes |
| `contributors` | who shipped the release |

The intro and the outro, with the version and the install command, are generated: never planned.

## Test

| Case | Pass |
| --- | --- |
| Uncovered feature | script names it; plan gains a scene or a skip |
| Skip without reason | script fails; reason added |
| Release with no `feat:` commit | no video; plan left empty |
| Invented demo value | marked as an example in the scene |
| `fix:` commits a user would notice | one grouped scene; internal ones left out |
| Contributor list | bots dropped; one `contributors` scene, last |
| Scene without a lead | refused on review: a viewer could not tell what it brings |
| Intro | a short hook and outcomes, within the limits, that make a newcomer want to watch on |
| Text over the limits | the script fails naming the intro tagline, a highlight or a lead |
