# Deployment

Where the project runs and how it ships: CI/CD, environments, and release.

> CLI build, publish and self-update detail: [`cli/aidd_docs/memory/deployment.md`](../../cli/aidd_docs/memory/deployment.md).

## Pipeline

| Workflow | Runs |
| --- | --- |
| `ci.yml` | commitlint (pull requests, `main`'s tip, the PR title a squash merge uses), then release-please on `main` and the release jobs |
| `cli-ci.yml` | the `cli` and `kanban` gates, jobs in the CLI bank. No `paths:` filter: a `changes` job decides in bash what has work. Mutations skip only for a verified `promote/next-to-main-*` snapshot; anything unproven keeps normal scopes |
| `validate.yml` | manifests against their schemas, plus the whole pre-commit over the whole tree |
| `codeql.yml` | code scanning |
| `promote.yml` | checks the release video covers what ships, opens the `next` to `main` PR, auto-merges |
| `back-merge.yml` | folds `main` into `next` after each release |
| `dependabot-auto-merge.yml` | merges dependency PRs that pass |
| `close-finished-milestones.yml` | closes a milestone once its issues are |
| `star-history.yml` | refreshes the README star chart |
| `opencode.yml` | runs the OpenCode agent on a `/opencode` comment from the repository owner, nobody else |

Push to `main` is automatic. Manual runs: `promote.yml`, `close-finished-milestones.yml`, `star-history.yml`.

## Environments

No server, container or IaC. What ships are release assets and packages.

| Target | Where |
| --- | --- |
| Repository | <https://github.com/ai-driven-dev/framework> |
| npm | `@ai-driven-dev/cli`, OIDC trusted publishing, no token |
| Archives | GitHub Releases |
| Hosted marketplaces | <https://github.com/ai-driven-dev/marketplaces> |
| Mirror | GitHub Packages, npm package only, best-effort |

## Release

Branch model in `vcs.md`, cadence and safety rules in [`RELEASE.md`](../../RELEASE.md).

```mermaid
flowchart TD
    RP["release-please PR, auto-merged"] --> Tags["tags + umbrella release as draft"]
    Tags --> Back["back-merge.yml: main into next"]
    Tags --> Jobs["attach: bundle, per-tool distributions, plugin archives, video"]
    Tags --> Cli["publish-cli: npm"]
    Jobs --> Pub["publish-release: draft to latest"]
    Pub --> Markets["publish-marketplace: one job per tool"]
    Markets --> Recap
    Cli --> Recap
    Pub --> Recap["release-recap: job log"]
    Pub --> N8N["n8n workflow"]
    N8N --> YT["YouTube"]
    YT --> DC["Discord"]
    YT --> SK["Skool"]
    DC --> Slack["Slack recap"]
    SK --> Slack
```

- The Release PR merges with `--merge --admin`: the only method `.github/rulesets/main.json` allows, so `main` never holds merged but unversioned code.
- Tags: umbrella, `cli-v<semver>`, `<plugin>-v<semver>`. `scripts/credit-release-authors.cjs` appends each author as `(@login)`, a workaround until [googleapis/release-please#2892](https://github.com/googleapis/release-please/pull/2892) ships.
- The umbrella stays a draft until every asset is attached; its publication is the event n8n listens to.
- After publication, each marketplace job reads its own release ZIP and publishes its own tool branch and immutable version tag in the distribution repository. A failed job leaves the release and the other marketplace jobs independent.
- Enable `AIDD_PUBLISH_MARKETPLACES=true` on `framework` after the organization owner adds `marketplaces` to the existing `aidd-bot` GitHub App installation with Contents write access. Before the legacy catalog switches to its new source, `claude-legacy` must already contain the previous public Claude Code release. It advances for the first two published Claude releases after activation.
- The root Claude Code catalog uses `source: "git-subdir"` for the historical native marketplace and `kind: "local"` for AIDD CLI consumers. The release ZIP keeps local paths. Preserve the legacy roster when changing the build roster after the transition.
- A failed video build keeps the release a draft, so nothing is announced without its video. A failed YouTube upload does not stop Discord and Skool: they post without the video link. Their text is the video's programme, one section per theme, so the announcements say what the video shows.

Config: `release-please-config.json`, eleven packages. Manifest: `.release-please-manifest.json`.

## Gotchas

- `build-per-tool` builds the CLI from this run's own checkout (`pnpm build`, then `node cli/dist/cli.js translate`), never a pinned published version: nothing to bump, nothing to go stale.

## Local reload

`make reload` installs every plugin into the installed hosts with `aidd setup --global` from this checkout, then syncs generic delegation guidance; details in `scripts/dev-sync.sh`.

## Monitoring

None. Failures are a red run; `back-merge.yml` opens an issue when it cannot push.
