# 01 - Plan

Cover every feature shipped since the last release with one scene, or one written reason.

## Input

The repository at the release candidate, read again from the last release tag, never from the previous plan.

## Process

1. Read every commit since the last release tag with `git log <last-tag>..HEAD --no-merges`, and keep what a user would notice.
   - A `refactor:` or `docs:` commit that changes how a skill behaves counts.
   - No `feat:` commit since the tag: stop, no video, plan left empty.
2. Run the check, and give each surface under `Scènes manquantes` a scene or a skip.
   - The check sees only `feat:` commits, so it proves nothing beyond them.
3. Open the skill or command each surface names, and take its real behavior.
4. Fill the [plan template](../assets/scenes-template.json) with one scene per surface, using the templates, rows and fields of [scenes.md](../references/scenes.md).
   - Title, tag or highlight: write it in everyday words, the user's gain first, as `See what your AI costs, in Codex too`.
   - Title that names a feature without its gain: rewrite it.
   - Measured gain: put one figure in the title, computed from the scene's own before and after, and no row of numbers beside it.
   - Lead: leave it out unless the scene cannot be understood without it.
   - Real commands: only in the demo window.
5. Move a surface to `skipped`, with a reason, only when a user would not notice it.
6. List the `fix:` commits since the tag, and group the ones whose before and after show on screen into one `bullet-grid` scene.
   - A fix that only makes figures or states more reliable gets no scene.
7. List the release's contributors with `gh api repos/{owner}/{repo}/compare/<last-tag>...next --jq '[.commits[].author.login] | unique'`, bots dropped.
   - Add whoever opened an issue closed since the tag, from `gh api "repos/{owner}/{repo}/issues?state=closed&since=<last-tag date>" --paginate --jq '[.[] | select(.pull_request == null) | .user.login] | unique'`.
   - Put the logins in one `contributors` scene, last.
8. Leave `intro` empty, so the video opens on `youtube.themes` as the thumbnail does.
   - User asks for tags: fill `intro.highlights` with up to five sentences of five words at most, the user's gain first, and no `tagline`.
9. Fill `youtube` in French: it is the one release message, shown as written by the YouTube description, the Discord post and the Skool page.
   - `themes`: the release's themes, in scene order.
   - `programme`: one line per scene, saying in French what its title and lead say on screen, as `4 nouveaux agents : explorer, executor, validator, reviewer.`, never one line per surface.
   - Each line: its `theme`, one of `themes`, and its `surface`, the command the scene shows.
   - Scene showing two commands: one line for each.
10. Read the plan against [judge.md](../references/judge.md), and rewrite or remove each failing scene.
11. Run `node .claude/skills/release-video/assets/check-release-video.js`, fix what it names, and repeat until it passes.
12. Show the plan to the user, fold the corrections, then read [render](02-render.md).

## Output

`aidd_docs/release-video/scenes.json` that the check accepts.

## Rules

- Rebuild every scene from this release's log, never keep one because it was there.
- Every `programme` line needs a `surface`, because the announcements cannot print a line without one.
