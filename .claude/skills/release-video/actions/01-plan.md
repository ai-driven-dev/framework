# 01 - Plan

Cover every feature shipped since the last release with one scene, or one written reason.

## Input

The repository at the release candidate.

## Output

`aidd_docs/release-video/scenes.json` that `node .claude/skills/release-video/assets/check-release-video.js` accepts; the next step is [render](02-render.md).

## Process

1. **List.** Run the check. Each surface under "Scènes manquantes" needs a scene or a skip.
2. **Read.** Open the skill or command each surface names; take its real behavior, never a guess.
3. **Draft.** Fill the [plan template](../assets/scenes-template.json), one scene per surface, with the templates, rows and fields of [scenes.md](../references/scenes.md).
   - Write every title, lead, tag and highlight in everyday words, outcome first: what changes for the user, not how it works. `Count tokens in Codex too` becomes `See what your AI costs, in Codex too`.
   - Only the demo window shows real commands.
4. **Skip.** Move a surface to `skipped` with a reason only when a user would not notice it.
5. **Fixes.** List the `fix:` commits since the last release tag. A fix is worth a scene only when its before and after can be shown on screen; a fix that only makes figures or states more reliable has none. Group the ones that qualify into one `bullet-grid` scene; the usual outcome is no scene.
6. **Contributors.** Name who shipped the release with `gh api repos/{owner}/{repo}/compare/<last-tag>...next --jq '[.commits[].author.login] | unique'`. Drop bots, keep every human author whatever the type of the commit (a docs commit counts). Put the logins in one `contributors` scene, last.
7. **Intro.** Fill `intro.highlights`, the tags that name the release's big features, so that someone who never used AIDD sees at a glance what it brings: up to three, each a short clear sentence of five words at most, starting from what the user gets (`Telemetry now covers Codex`, not `Report by tool`). Leave `tagline` out: a phrase above the tags says less than they do. Take the facts from the release announcement, so the video and the message say the same thing.
8. **YouTube text.** Fill `youtube` in French, in the words of the published videos: `themes` name the release's themes, `programme` has one line per covered surface saying what it does, as in `compter ce que coûte votre travail, par tâche`. `assets/youtube-metadata.js` assembles the title and the description in their published layout.
9. **Judge.** Read the plan against [judge.md](../references/judge.md), which the check cannot do.
10. **Check.** Rerun the check until it passes, then show the plan and fold corrections.

## Test

| Case | Pass |
| --- | --- |
| Uncovered feature | the check names it; the plan gains a scene or a skip |
| Skip without reason | the check fails; a reason is added |
| Release with no `feat:` commit | no video; plan left empty |
| Invented demo value | marked as an example in the scene |
| `fix:` commits a user would notice | one grouped scene; internal ones left out |
| Contributor list | bots dropped; one `contributors` scene, last |
| Scene without a lead | refused on review: a viewer could not tell what it brings |
| Internal word or text over the limits | the check fails naming the word or the field and where it is |
| Theme split by another one | the check fails naming the theme; its scenes are brought together |
| Surface with no `programme` line, or a title over 100 characters | the check fails naming it |
| Plan read against the judge list | every rule answered, a failing scene rewritten or removed |
