# Deployment

## Environment Variables

- `AIDD_TOKEN` — authentication token for GitHub Packages (private registry)

## Build & Publish

- Build: `pnpm build` → `dist/cli.js` (tsup, ESM bundle); runs `scripts/check-bundle-size.mjs` automatically
- Bundle budget: 500 KB (`bundleBudgetKB` in `package.json`); build fails if exceeded
- Local install test: `pnpm run install:local` (packs and installs globally via npm)
- Publish: `pnpm publish` targeting GitHub Packages registry (`@ai-driven-dev` scope)
- Runtime requirements: Node.js >= 24, pnpm >= 9

## Tooling facts

- **Biome** is the sole linter + formatter — no ESLint, no Prettier. Config at repo root (`biome.json`). Fix with `biome check --write`.
- **Lefthook** runs git hooks; commitlint enforces Conventional Commits.

## Git Hooks

- lefthook delegates `pre-commit` and `pre-push` to parent monorepo via `pnpm exec lefthook run <hook>`
- commitlint validates commit message format on commit

## CI/CD

- `.github/workflows/ci-commitlint.yml` — commitlint on push to `main` and all PRs
- No containerization
- No monitoring infrastructure

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm build` | tsup production build + bundle size check |
| `pnpm test` | build + vitest run (all tests) |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm lint` | biome check |
| `pnpm format` | biome format --write |
| `pnpm pack:local` | build + pack to dist/ |
| `pnpm install:local` | pack + npm install -g |
| `pnpm build:check-size` | run bundle size check only (no rebuild) |
| `pnpm bench:check` | run perf regression check against baseline |
| `pnpm test:mutation` | Stryker mutation testing (slow; CI gate) |

## Perf Regression

- Baseline: `scripts/perf-baseline.json` — 4 commands tracked (`--version`, `--help`, `status`, `ai list`)
- Checker: `scripts/check-perf-regression.mjs` — fails build if median exceeds baseline by threshold
- Update baseline with `scripts/benchmark.mjs`
