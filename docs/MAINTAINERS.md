# Maintainers guide

How to operate this repository day to day. This file is the **Habilité** (maintainer) playbook — it does not restate the others:

- **Who** may do what + decision rules → [`GOVERNANCE.md`](../GOVERNANCE.md).
- **How contributors work** → [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## 🧩 The moving parts

| Thing | Where | Note |
| ----- | ----- | ---- |
| Published plugins | `.claude-plugin/marketplace.json` + `plugins/` | the only thing shipped in a release |
| Live backlog & roadmap | [Project board #8](https://github.com/orgs/ai-driven-dev/projects/8) | single source of truth |
| Roles → access | GitHub teams `habilitated` / `certified` / `core-team` | mapped to the role ladder |
| Branch protection | ruleset "main protection" + `.github/rulesets/main.json` | `main` is PR-only |
| Releases | release-please (`ci.yml`) + `release-please-config.json` | 8 packages (root + 7 plugins), auto |
| Pre-commit checks | `lefthook.yml` + `scripts/` | json/yaml/schema/frontmatter/catalogs/counts |

## 📅 Daily

- **Triage issues.** New issues auto-add to board #8. Set `Status` / `Area` / `Priority`; link under an epic (native sub-issues) if relevant. **Type** is the issue/PR label, not a board field (see [Project board layout](#-project-board-project-8)).
- **Roadmap.** Priority = the community vote (mechanism in `GOVERNANCE.md`). Accepted items live on board #8 — keep `ROADMAP.md` a pointer, don't maintain a second list.
- **Review PRs.** Approve as CODEOWNERS, then squash-merge (merge policy → [`GOVERNANCE.md`](../GOVERNANCE.md#-code-decisions-merging)).

## 📋 Project board (Project 8)

The board is a **view** of the taxonomy the docs define, never its own. Each property answers one question: **Type** = the label · **Priority** = urgency · **Status** = flow position · **When** = Timeline. Routing (`next`/`main`) is *not* a board property — it derives from the branch prefix ([routing table](../aidd_docs/memory/vcs.md#types)).

One-time layout (org-admin / board-write; get field IDs via `gh project field-list 8 --owner ai-driven-dev`):

- **Drop** `Work type` (duplicates Type) and `Phases` (duplicates Status) — `gh project field-delete --id <ID>`.
- **Keep** `Priority` (P0 · P1 · P2) and `Area`.
- **`Status`** options, in order: `Todo · In progress · In review · Ready · Done` (built-in field — edit its values in the UI).
- **Timeline view** — new view, date = Milestone/target; use it as the roadmap horizon.

Status automation (Project → ⋯ → Workflows); `In progress` is the one manual move:

| Trigger (built-in) | Status |
| --- | --- |
| Item added | `Todo` |
| PR linked / ready for review | `In review` |
| Code review approved | `Ready` |
| PR merged · item closed | `Done` |

## 🏷️ Labels

[`.github/labels.yml`](../.github/labels.yml) is the canonical set (triage only — routing is by branch prefix). The sync loop **creates/updates** from the file; it does **not** delete. So when you remove a label from the file, also delete it on GitHub:

```bash
gh label delete "help wanted" --yes
gh label delete npm --yes
gh label delete "github-actions" --yes
```

Dependabot labels its PRs `dependencies` only (ecosystem sub-labels were dropped); confirm `.github/dependabot.yml` does not re-add a deleted label before deleting it.

## 🚀 Releases

release-please opens/updates a `chore: release main` PR on each push to `main`.

1. (Optional) Review the version bumps + changelog. Authored by the **aidd-bot** App, so its checks run normally.
2. CI **auto-merges** it with the App token (`--squash --admin`); no human step needed. `--admin` is required because a plain `gh pr merge` is refused even for the bypass App.
3. CI tags each bumped package, creates the GitHub Releases, and attaches the bundles:
   - `aidd-framework-marketplace-X.Y.Z.zip` (`.claude-plugin/` + `plugins/`)
   - `<plugin>-vX.Y.Z.zip`
   - `aidd-framework-<tool>-<mode>-X.Y.Z.zip` - per-tool distributions (9 archives: 4 marketplace claude/cursor/copilot/codex + 5 flat incl. opencode), produced by the `build-per-tool` matrix job in `ci.yml` via `aidd-cli framework build`. **Pinned** to a specific `@ai-driven-dev/cli` version - bump it deliberately when adopting CLI build changes.

Versions live in `.release-please-manifest.json`. Forcing a version / pre-release: `release-as` in `release-please-config.json` (remove it after the release ships).

## 🔄 Promotion & recovery

The weekly `next` → `main` promotion **must rebase, never squash**:

- A squash collapses the batch's conventional commits into one subject from the PR title. If that title isn't a valid conventional type, `Commitlint` fails on `main` and **release-please is skipped** — no release.
- release-please also reads each commit's type/scope to bump the right package, which a squash hides.
- Use the **Promote next to main** workflow (it rebase-merges); merging by hand, pick **Rebase and merge**.
- The Release PR release-please opens is its own single commit and is fine to squash.

**Recovery** — a bad squashed promote turns `main` red on `Commitlint` and skips **Release Please**. An admin:

1. Temporarily disables the `main protection` ruleset (Settings → Rules).
2. Force-pushes `main` back to the commit before the bad merge.
3. Re-enables the ruleset, then re-runs **Promote**.

## 📦 Dependencies (Dependabot)

- **Patch + minor bumps auto-merge** once checks pass (`.github/workflows/dependabot-auto-merge.yml`, via the aidd-bot App).
- **Major bumps stay manual** — review, then `gh pr merge <n> --squash`.
- Several lockfile bumps queued: the first merges and the rest re-base automatically (or comment `@dependabot rebase`).

## 🔒 Branch protection & the bot bypass

The protection policy (PR-only, CODEOWNERS review, required checks) is defined in [`GOVERNANCE.md`](../GOVERNANCE.md#-code-decisions-merging); this is the ops.

Two bypass actors (both `pull_request` mode, so neither can push directly to `main`):
- the **aidd-bot GitHub App** (`Integration`) - release-please and the Dependabot auto-merge mint a token from it (`actions/create-github-app-token`), so their PRs trigger the required checks *and* the App merges them past the human-review rule.
- the **`admin` team** - lead maintainers can merge their own PR without a second review. Everyone else needs a code-owner review.

The App: ID in secret `AIDD_BOT_APP_ID`, key in `AIDD_BOT_PRIVATE_KEY`. If the App is broken/uninstalled, release and Dependabot PRs stop merging - fix the App rather than re-adding an admin bypass.

Head branches are **not** auto-deleted on merge (`delete_branch_on_merge: false`):

- The promote PR merges `next` into `main` without deleting `next`, so the back-merge that realigns `next` never hits a missing branch. **Do not re-enable** the setting.
- The back-merge runs unattended (bot App `always` bypass on the `next` ruleset). If it can't push, it opens an issue labelled `back-merge-failed` — resync with a `main` → `next` PR.
- If `next` is ever missing, recreate it: `git push origin main:next`.

To change protection, edit `.github/rulesets/main.json` (or `next.json`), then apply it live:
```bash
gh api -X PUT repos/ai-driven-dev/framework/rulesets/<id> --input .github/rulesets/main.json
```
Keep the file and the live ruleset in sync.

## 👥 People

Roles, promotion, and inactivity rules → [`GOVERNANCE.md`](../GOVERNANCE.md#-roles). Team mechanics only:

- Habilité ↔ `habilitated` team + `CODEOWNERS`.
- Core Team / Certifié ↔ `core-team` / `certified` teams.

## 🛡️ Security

- Vulnerabilities: GitHub Security Advisories (see `SECURITY.md`); never a public issue.
- Secret scanning + push protection + Dependabot alerts are enabled. Push protection blocks new secret commits; it does not scan history, so never paste tokens.
- Plugin-specific runtime risks (CI permissions, MCP servers) belong in that plugin's README, not here.

## ✋ Do NOT hand-edit

- **README counts** — the hero `N plugins · N skills · N agents` block (between the `counts:start`/`counts:end` markers) and each per-plugin `N skills` span — auto-generated by `scripts/sync-readme-counts.mjs` via lefthook.
- **Per-plugin `CATALOG.md`** — auto-generated by `scripts/summarize-markdown.js` via lefthook.
- **`CONTRIBUTORS.md` mosaic** — the contrib.rocks image updates itself.

## 🛠️ Multi-tool

- The marketplace is Claude Code native.
- Other tools are served by per-release archives the `aidd-cli` builds; this repo stays Claude-authored and tool-agnostic in its prose.
- Keep tool-specific detail in plugin READMEs.

## 🧱 Build your own plugin

See [Add a plugin](../CONTRIBUTING.md#-add-a-plugin).
