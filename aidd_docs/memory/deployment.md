# Deployment

How the repository ships: CI, targets and release. CLI build and publish: [CLI deployment](internal/cli/deployment.md).

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
| Hosted marketplaces | <https://github.com/ai-driven-dev/marketplaces> |
| Mirror | GitHub Packages, npm package only, best-effort |

## Release

Branch model: `vcs.md`. Cadence and safety rules: [`RELEASE.md`](../../RELEASE.md).

- The release PR merges with `--merge --admin`, the only method `.github/rulesets/main.json` allows.
- So `main` never holds merged but unversioned code.
- Tags: umbrella, `cli-v<semver>`, `<plugin>-v<semver>`.
- `scripts/credit-release-authors.cjs` appends each author as `(@login)`, until release-please credits authors itself.
- The umbrella stays a draft until every asset is attached; n8n listens for its publication.
- After publication, each marketplace job reads its own release ZIP and publishes its own tool branch and immutable version tag in the distribution repository. A failed job leaves the release and the other marketplace jobs independent. n8n announces the release on its publication, before the catalogs move. The job pushes the immutable version tag, verifies that tag with the tool's real client, and only then advances the stable branch, so a failed tool keeps serving its previous release on its stable branch.
- Publication runs only while `AIDD_PUBLISH_MARKETPLACES` is `true` on `framework`, and needs `marketplaces` in the `aidd-bot` GitHub App installation with Contents write access. `docs/INSTALL.md` switches Copilot and Codex to `aidd-marketplace` in the same change that flips it.
- A failed video build keeps the release a draft: nothing is announced without its video.
- A failed YouTube upload still lets Discord and Skool post, without the video link.
- Their text is the video's programme, one section per theme.

- Config: `release-please-config.json`. Versions: `.release-please-manifest.json`.

## Gotchas

- `build-per-tool` builds the CLI from the run's own checkout, never a published version: nothing to bump or go stale.
- Each hosted catalog comes from the same ZIP used for local marketplace installs, renamed `aidd-marketplace` for every tool because the CLI reserves `aidd-framework`. The tools published are the ones the CLI's tool registry says have a catalog (`scripts/marketplace-tools.cjs`). Client versions are pinned in `scripts/marketplace-distribution.json` where Dependabot does not look: bumping them is manual.

## Local reload

- `make reload` installs every plugin from this checkout into the installed hosts with `aidd setup --global` (`scripts/dev-sync.sh`).

## Monitoring

- None: a failure is a red run; `back-merge.yml` opens an issue when it cannot push.
