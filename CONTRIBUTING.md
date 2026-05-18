# Contributing to AIDD CLI

> **Mission:** Make AI-Driven Development accessible with a complete, consistent package for developers.

Code contributions are open to certified **Obsidian+** members using the AIDD development flow.

---

## Who can contribute

| Action              | Who                         |
| ------------------- | --------------------------- |
| Report issues       | Any AIDD member             |
| Improve docs        | Any AIDD member             |
| Develop features    | Certified Obsidian+ members |
| Review PRs          | Coaches                     |
| Merge PRs to `main` | Baptiste only               |

---

## Architecture

3-layer clean architecture — understand this before contributing code.

```
src/
├── cli.ts                    # Commander entry point
├── domain/                   # Business models, port interfaces, tool configs
├── application/              # Use cases + commander commands + output formatting
└── infrastructure/           # Port implementations: filesystem, HTTP, cache, auth
```

**Rules:**
- Domain has zero infrastructure imports (enforced in tests)
- Use cases live in `application/use-cases/`, commands in `application/commands/`
- New runtime dependencies require explicit justification — max 2 allowed (`commander`, `@inquirer/prompts`)

For full details: [aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)

**Plugin translator (dual-mode core):** [aidd_docs/translator-dual-mode.md](aidd_docs/translator-dual-mode.md) — required reading before adding a new AI tool.

---

## Development setup

**Prerequisites:** Node.js >= 24, pnpm >= 9, Git

No private registry token needed — all dependencies are on the public npm registry.

```bash
git clone git@github.com:ai-driven-dev/aidd-cli.git
cd aidd-cli

pnpm install    # install dependencies + set up git hooks (lefthook)
pnpm build      # compile to dist/cli.js
```

> `pnpm install` automatically installs [Lefthook](https://github.com/evilmartians/lefthook) git hooks via the `prepare` script. Hooks run commitlint on commit and the full test suite on push.

---

## Development workflow

### 1. Pick a task

**[Open the project board](https://github.com/orgs/ai-driven-dev/projects/5)**

Pick an issue from the **Ready** column, assign yourself, move it to `In Progress`.

### 2. Create a branch

```bash
git checkout -b feat/your-feature-name   # new feature
git checkout -b fix/bug-description      # bug fix
git checkout -b docs/what-you-updated    # documentation
```

### 3. Write tests first

All contributions require tests. For bug fixes, write a failing test before touching the implementation.

```bash
pnpm test:watch     # run tests in watch mode while developing
```

**Never mock functional behavior in tests.** Use real filesystem operations via temp directories (see existing e2e tests for patterns).

Coverage thresholds apply to the business logic layer (use-cases, domain models, tools, infrastructure adapters). Commands and entrypoint are tested via e2e only and excluded from thresholds.

### 4. Implement

Use the AIDD flow throughout — this project is built with its own tooling.

```bash
pnpm typecheck          # TypeScript check
pnpm lint               # lint + format (biome)
pnpm knip:production    # detect unused exports and dependencies
pnpm jscpd              # detect code duplication in src/
```

**Code standards:**
- Throw early — no silent errors
- Small, single-responsibility functions
- No duplication — abstract only when it appears 3+ times
- No comments on obvious code — make the code self-explanatory
- Only comment genuinely tricky logic

### 5. Run the full suite

```bash
pnpm test                    # build + full suite (unit + e2e)
pnpm test -- --coverage      # same + coverage report with thresholds
```

All CI checks must pass locally before pushing.

### 5b. Performance regression check

CLI boot time and key command durations are tracked via a committed baseline snapshot.

```bash
pnpm bench            # run benchmark, writes reports/benchmark/latest.json
pnpm bench:check      # compare latest vs scripts/perf-baseline.json
```

Thresholds:
- >20% slower than baseline → warning (exit 0)
- >50% slower than baseline → hard failure (exit 1)
- >5% faster than baseline → note (suggests baseline update)

**When to update the baseline:**
If you make an intentional performance improvement, regenerate the baseline in the same PR:

```bash
pnpm bench
cp reports/benchmark/latest.json scripts/perf-baseline.json
# commit scripts/perf-baseline.json alongside your changes
```

CI runs the benchmark on every PR and push to `main` (`.github/workflows/perf-regression.yml`).

#### Network E2E tests (opt-in)

Network E2E tests exercise the real GitHub fetch path (`ai-driven-dev/aidd-framework`). They are skipped in the default `pnpm test` run and require opt-in:

```bash
RUN_NETWORK_TESTS=1 pnpm test:e2e tests/e2e/network.e2e.test.ts
```

These tests run automatically every night via the `network-e2e.yml` workflow. They do not count against the regular E2E budget and must not be run in offline/CI environments that lack GitHub access.

### 6. Test the CLI manually _(optional)_

```bash
pnpm run install:local      # build + install globally

mkdir /tmp/aidd-test && cd /tmp/aidd-test
aidd setup

aidd ai install claude              # single AI tool
aidd ai install claude --force      # reinstall (overwrite existing)
aidd ai list                        # list installed AI tools
aidd ai status                      # show drift for AI tools

ls .claude/                         # verify output was generated
```

### 7. Open a Pull Request

Push your branch and open a PR to `main`. The PR template is applied automatically. Assign **Baptiste** as reviewer.

---

## Commit message format

Follow [Conventional Commits](https://www.conventionalcommits.org/). The type determines whether a release is triggered.

| Type | When to use | Triggers release |
| --- | --- | --- |
| `feat` | New user-facing feature | Yes (minor) |
| `fix` | Bug fix in CLI behavior | Yes (patch) |
| `perf` | Performance improvement | Yes (patch) |
| `refactor` | Internal refactoring, no behavior change | No |
| `test` | Adding or updating tests | No |
| `docs` | Documentation only | No |
| `ci` | CI/CD changes | No |
| `chore` | Maintenance, dependency updates | No |
| `style` | Formatting, no logic change | No |

```bash
feat: add restore --docs flag
fix(status): correct hash comparison for merged files
docs: update aidd ai install examples
ci: add coverage thresholds to pipeline
```

> Use `fix(ci):` only if the fix is a CI-related **bug fix**. Prefer `ci:` for CI improvements — `fix(ci):` triggers a release.

---

## CI checks

Every PR triggers:

| Job | Command | Blocking |
| --- | --- | --- |
| Commitlint | — | Yes |
| Typecheck | `pnpm typecheck` | Yes |
| Lint | `pnpm lint` | Yes |
| Test & Coverage | `pnpm test -- --coverage` | Yes |
| Dead code | `pnpm knip:production` | No |
| Duplication | `pnpm jscpd` | No |
| Perf regression | `pnpm bench && pnpm bench:check` | Yes (>50% regression) |

All blocking jobs must pass before merge.

---

## Pull Request process

1. Fill the PR template (description, test plan, checklist).
2. Assign **Baptiste** as reviewer.
3. Address review comments — don't close threads yourself.
4. Baptiste merges when approved.

PRs targeting `main` directly are not accepted without review.

---

## Reporting issues

**[Create an issue](https://github.com/ai-driven-dev/aidd-cli/issues/new/choose)** using the templates:

- 🐛 **Bug Report** — unexpected behavior
- ✨ **Feature Request** — new feature proposal

Set the appropriate labels (type, priority, complexity) when creating the issue.

---

## Publishing

Fully automated — no manual steps.

1. Merge a PR into `main`
2. [Release Please](https://github.com/googleapis/release-please) opens/updates a release PR based on conventional commits
3. Merging the release PR creates a GitHub release
4. The publish workflow automatically publishes to GitHub Packages

> Never manually edit `package.json` version fields.

---

← [Back to CLI](./README.md)
