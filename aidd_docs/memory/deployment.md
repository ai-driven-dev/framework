# Deployment

## Environment Variables

- `AIDD_TOKEN` — authentication token for GitHub Packages (private registry)
- `AIDD_REPO` — custom framework repository override in `owner/repo` format (optional)

## Build & Publish

- Build: `pnpm build` → `dist/cli.js` (tsup, ESM bundle)
- Local install test: `pnpm run install:local` (packs and installs globally via npm)
- Publish: `pnpm publish` targeting GitHub Packages registry (`@ai-driven-dev` scope)
- Runtime requirements: Node.js >= 24, pnpm >= 9

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
| `pnpm build` | tsup production build |
| `pnpm test` | build + vitest run (all tests) |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm lint` | biome check |
| `pnpm format` | biome format --write |
| `pnpm pack:local` | build + pack to dist/ |
| `pnpm install:local` | pack + npm install -g |
