# Deployment

How the repository ships: CI, targets and release. CLI build and publish: [CLI deployment](cli/deployment.md).

## Pipeline

| Workflow | Runs |
| --- | --- |
| `ci.yml` | commitlint, then release-please on `main` and the release jobs |
| `cli-ci.yml` | the `cli` and `kanban` gates |
| `validate.yml` | manifests against their schemas, and the pre-commit over the whole tree |
| `codeql.yml` | code scanning |
| `promote.yml` | checks the release video, opens the `next` to `main` PR, auto-merges |
| `release-video-dry-run.yml` | renders the release video on a pull request touching it, publishing nothing |
| `back-merge.yml` | folds `main` into `next` after each release |
| `dependabot-auto-merge.yml` | merges dependency PRs that pass |
| `close-finished-milestones.yml` | closes a milestone once its issues are |
| `star-history.yml` | refreshes the README star chart |
| `opencode.yml` | runs the OpenCode agent on the repository owner's `/opencode` comment |

- Manual runs: `promote.yml`, `close-finished-milestones.yml`, `star-history.yml`.

## Environments

Only release assets and packages ship.

| Target | Where |
| --- | --- |
| Repository | <https://github.com/ai-driven-dev/framework> |
| npm | `@ai-driven-dev/cli` |
| Archives | GitHub Releases |
| Mirror | GitHub Packages, npm package only, best-effort |

## Release

Branch model: `vcs.md`. Cadence and safety rules: [`RELEASE.md`](../../../RELEASE.md).

- The release PR merges with `--merge --admin`, the only method `.github/rulesets/main.json` allows.
- So `main` never holds merged but unversioned code.
- Tags: umbrella, `cli-v<semver>`, `<plugin>-v<semver>`.
- `scripts/credit-release-authors.cjs` appends each author as `(@login)`, until release-please credits authors itself.
- The umbrella stays a draft until every asset is attached; n8n listens for its publication.
- A failed video build keeps the release a draft: nothing is announced without its video.
- A failed YouTube upload still lets Discord and Skool post, without the video link.
- Their text is the video's programme, one section per theme.

- Config: `release-please-config.json`. Versions: `.release-please-manifest.json`.

## Gotchas

- `build-per-tool` builds the CLI from the run's own checkout, never a published version: nothing to bump or go stale.

## Local reload

- `make reload` installs every plugin from this checkout into the installed hosts with `aidd setup --global` (`scripts/dev-sync.sh`).

## Monitoring

- None: a failure is a red run; `back-merge.yml` opens an issue when it cannot push.
