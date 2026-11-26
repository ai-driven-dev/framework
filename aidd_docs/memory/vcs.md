# VCS

## Setup

- GitHub, `ai-driven-dev/framework`, driven through `gh`; tickets are GitHub Issues.
- `main` is production and GitHub's default; `next` is integration. `gh pr create` needs `--base next`.
- Pull request template: `.github/PULL_REQUEST_TEMPLATE.md`.
- Release model: [`RELEASE.md`](../../RELEASE.md); its tooling: `deployment.md`.

## Branches

- Format: `type/short-description`. The prefix alone decides the PR target; `aidd-vcs:02-pull-request` reads this table.

| I want to… | Issue template | Branch | Commit | Issue type | PR targets |
| ---------- | -------------- | ------ | ------ | ---------- | ---------- |
| ship a feature | 🌱 Quick Contribution | `feat/…` | `feat:` | `Feature` | `next` |
| fix a bug | 🐛 Bug Report | `fix/…` | `fix:` | `Bug` | `next` |
| change docs only | 📋 Detailed Contribution | `docs/…` | `docs:` | `Task` | `next` |
| refactor (no behaviour change) | 📋 Detailed Contribution | `refactor/…` | `refactor:` | `Task` | `next` |
| build / config / deps | 📋 Detailed Contribution | `chore/…` | `chore:` | `Task` | `next` |
| add or update tests | 📋 Detailed Contribution | `test/…` | `test:` | `Task` | `next` |
| 🚨 urgent production fix | 🐛 Bug Report | `hotfix/…` | `fix:` | `Bug` | **`main`** |

- Only `hotfix/*` targets `main`; everything else ships in the weekly release.
- The issue type categorizes; it never routes.
- Automation owns `promote/*` and `back-merge/*`, outside this table.
- Board conventions: `backlog.md`.

## Pull requests

- A stacked pull request targets its base branch. Retarget it with `gh pr edit <n> --base next` before merging the base.
- Never delete a branch another open pull request targets: GitHub closes that pull request.
- After a squash merge of the base, replay only the dependent's commits: `git rebase --onto origin/next <base's last commit>`, then `--force-with-lease`.

## Commits

- Conventional Commits, enforced by `commitlint.config.cjs`; read it first, it wins over this page.
- `type(scope): description`: imperative, lowercase, no trailing period, header at most 100 characters.
- Scope is optional and kebab-case; `scope-enum` only warns. `cli` is the CLI's scope.
- release-please attributes a change by path, never by scope.
- A breaking change goes in the footer: `BREAKING CHANGE: …`.
