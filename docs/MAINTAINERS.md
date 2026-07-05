# Maintainers guide

How to operate this repository day to day. For **who** may do what and the decision rules, see [`GOVERNANCE.md`](../GOVERNANCE.md); for how contributors work, see [`CONTRIBUTING.md`](../CONTRIBUTING.md). This file is the **Habilité** (maintainer) playbook and does not restate those.

## The moving parts

| Thing | Where | Note |
| ----- | ----- | ---- |
| Published plugins | `.claude-plugin/marketplace.json` + `plugins/` | the only thing shipped in a release |
| Live backlog & roadmap | [Project board #8](https://github.com/orgs/ai-driven-dev/projects/8) | single source of truth |
| Roles → access | GitHub teams `habilitated` / `certified` / `core-team` | mapped to the role ladder |
| Branch protection | ruleset "main protection" + `.github/rulesets/main.json` | `main` is PR-only |
| Releases | release-please (`ci.yml`) + `release-please-config.json` | 7 packages, auto |
| Pre-commit checks | `lefthook.yml` + `scripts/` | json/yaml/schema/frontmatter/catalogs/counts |

## Daily

- **Triage issues.** New issues auto-add to board #8. Set `Status` / `Area` / `Priority`, and link under an epic (native sub-issues) if relevant. **Type** is the issue/PR label, not a board field (see [Project board layout](#project-board-project-8)).
- **Roadmap.** Priority is set by community vote (mechanism in `GOVERNANCE.md`). Accepted items live on board #8. Keep `ROADMAP.md` as a pointer only; do not maintain a second list.
- **Review PRs.** Every PR needs a Habilité (CODEOWNERS) approval, and `lefthook` and `Commitlint` checks must pass. Squash-merge.

## Project board (Project 8)

The board is a **view** of the taxonomy the docs already define; it never invents its own. Each property answers one question: **Type** is the label, **Priority** is how urgent, **Status** is where in the flow, **When** is the Timeline. Routing (`next` vs `main`) is *not* a board property; it derives from the branch prefix ([routing table](../aidd_docs/memory/vcs.md#types)).

Apply this layout once (org-admin or board-write needed). Read field IDs first:

```bash
gh project field-list 8 --owner ai-driven-dev   # note the IDs you need below
```

### Fields

- **Drop `Work type`**: it duplicates the Type label. **Drop `Phases`**: it duplicates Status/Milestone, and no milestone exists, so it's noise.
  ```bash
  gh project field-delete --id <WORK_TYPE_FIELD_ID>
  gh project field-delete --id <PHASES_FIELD_ID>
  ```
- **Keep `Priority`** (P0 · P1 · P2) and `Area`. No action needed.
- **`Status`**: single-select options, in order: `Todo` · `In progress` · `In review` · `Ready` · `Done`. `Status` is a built-in field, so edit its options in the UI (Board → `Status` field header → Edit values). The CLI can only *create* fields, so only use it if rebuilding from scratch:
  ```bash
  # from-scratch alternative only - NOT for editing the existing Status field
  gh project field-create 8 --owner ai-driven-dev --name Status \
    --data-type SINGLE_SELECT \
    --single-select-options "Todo,In progress,In review,Ready,Done"
  ```

### Status automation (UI: Project → ⋯ → Workflows)

GitHub built-in workflows drive most transitions; `In progress` is the one manual move.

| Trigger (built-in) | Set `Status` to |
| ------------------ | --------------- |
| Item added to project | `Todo` |
| Pull request linked / ready for review | `In review` |
| Code review approved | `Ready` |
| Pull request merged · item closed | `Done` |
| *(manual - picked up by a maintainer)* | `In progress` |

### Timeline view

Replaces the old "Phases". UI: **New view → Timeline**, date field = the Milestone / target date. Use it as the roadmap horizon (`this week` / `next` / `later`).

### Apply checklist

- [ ] `Work type` field deleted
- [ ] `Phases` field deleted
- [ ] `Priority` kept
- [ ] `Status` options = Todo · In progress · In review · Ready · Done
- [ ] Built-in Status workflows enabled (added→Todo, ready→In review, approved→Ready, merged/closed→Done)
- [ ] Timeline view present

## Labels

[`.github/labels.yml`](../.github/labels.yml) is the canonical set (triage only; routing is by branch prefix). The sync loop **creates/updates** from the file, but does **not** delete. So when you remove a label from the file, also delete it on GitHub:

```bash
gh label delete "help wanted" --yes
gh label delete npm --yes
gh label delete "github-actions" --yes
```

Dependabot labels its PRs `dependencies` only (ecosystem sub-labels were dropped); confirm `.github/dependabot.yml` does not re-add a deleted label before deleting it.

## Releases

release-please opens/updates a `chore: release main` PR on each push to `main`.

1. (Optional) Review the version bumps and changelog. The PR is authored by the **aidd-bot** App, so its checks run normally.
2. CI **auto-merges** it with the App token (`--squash --admin`). No human step is needed. `--admin` is required because a plain `gh pr merge` is refused even for the bypass App.
3. CI tags each bumped package, creates the GitHub Releases, and attaches the bundles:
   - `aidd-framework-marketplace-X.Y.Z.zip` (`.claude-plugin/` + `plugins/`)
   - `<plugin>-vX.Y.Z.zip`
   - `aidd-framework-<tool>-<mode>-X.Y.Z.zip`: per-tool distributions (9 archives: 4 marketplace for claude/cursor/copilot/codex, plus 5 flat including opencode), built by the `build-per-tool` matrix job in `ci.yml` via `aidd-cli framework build`. **Pinned** to a specific `@ai-driven-dev/cli` version; bump it deliberately when adopting CLI build changes.

Versions live in `.release-please-manifest.json`. Forcing a version / pre-release: `release-as` in `release-please-config.json` (remove it after the release ships).

## Dependencies (Dependabot)

**Patch and minor bumps auto-merge** once their checks pass (`.github/workflows/dependabot-auto-merge.yml`, via the aidd-bot App). **Major bumps stay manual**: review, then `gh pr merge <n> --squash`. If several lockfile bumps queue up, the first merges and the rest rebase automatically (or comment `@dependabot rebase`).

## Branch protection & the bot bypass

`main` accepts only PRs: no direct push, no force-push, no deletion. Every PR needs a CODEOWNERS review and passing `lefthook` / `Commitlint` checks.

Two bypass actors exist, both in `pull_request` mode, so neither can push directly to `main`:
- **The aidd-bot GitHub App** (`Integration`). Release-please and the Dependabot auto-merge mint a token from it (`actions/create-github-app-token`), so their PRs both trigger the required checks and get merged past the human-review rule by the App.
- **The `admin` team.** Lead maintainers can merge their own PR without a second review. Everyone else needs a code-owner review.

The App's ID is in secret `AIDD_BOT_APP_ID`, its key in `AIDD_BOT_PRIVATE_KEY`. If the App is broken or uninstalled, release and Dependabot PRs stop merging. Fix the App; do not re-add an admin bypass instead.

Head branches are **not** auto-deleted on merge (`delete_branch_on_merge: false`). The promote PR merges `next` into `main` without deleting `next`, so the back-merge that realigns `next` afterwards never hits a missing branch. Do not re-enable this setting.

To change protection, edit `.github/rulesets/main.json` (or `next.json`), then apply it live:
```bash
gh api -X PUT repos/ai-driven-dev/framework/rulesets/<id> --input .github/rulesets/main.json
```
Keep the file and the live ruleset in sync.

## People

- **Promote to Habilité**: a Habilité nominates a Certifié with a track record; a majority of Habilité approves; add them to the `habilitated` team and `CODEOWNERS`.
- **Core Team / Certifié**: managed via the `core-team` / `certified` teams (Core Team = paid AIDD programme members, Certifié = passed certification).
- 6 months of inactivity moves someone to emeritus, by Habilité majority.

## Security

- Report vulnerabilities via GitHub Security Advisories (see `SECURITY.md`), never a public issue.
- Secret scanning, push protection, and Dependabot alerts are all enabled. Push protection blocks new secret commits but does not scan history, so never paste tokens anywhere in the repo.
- Plugin-specific runtime risks (CI permissions, MCP servers) belong in that plugin's README, not here.

## Do NOT hand-edit

These files regenerate themselves. Hand edits get overwritten, or drift out of sync until the next automated run:

- **README counts** (`6 plugins · 31 skills · 3 agents`, and the per-plugin counts): generated by `scripts/sync-readme-counts.mjs` via lefthook.
- **Per-plugin `CATALOG.md`**: generated by `scripts/summarize-markdown.js` via lefthook.
- **`CONTRIBUTORS.md` mosaic**: the contrib.rocks image updates itself.

## Multi-tool

The marketplace is Claude Code native. Other tools are served by per-release archives that `aidd-cli` builds. This repo's prose stays Claude-authored and tool-agnostic; keep tool-specific detail in plugin READMEs.

## Build your own plugin

See [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md). New plugins must also be registered in `release-please-config.json` and `.release-please-manifest.json`, or they never release.
