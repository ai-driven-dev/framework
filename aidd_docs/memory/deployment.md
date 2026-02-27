# Deployment

## Project Structure

```plaintext
.                            # repo root (cli/)
├── lefthook.yml             # Git hooks delegation to parent monorepo
├── package.json             # npm package metadata
└── src/
    └── cli.ts               # CLI entry point
```

## Environment Variables

### Required Environment Variables

- `AIDD_TOKEN` — authentication token for GitHub Packages (private registry), required to install/publish the package
- `AIDD_REPO` — custom framework repository override (optional)

## Deployment Process

- Package: `@ai-driven-dev/aidd-cli`, distributed via GitHub Packages (private, community-gated)
- Publish: `pnpm publish` targeting the GitHub Packages registry
- Runtime requirement: Node.js >= 20, pnpm >= 9
- Git hooks: lefthook delegates `pre-commit` and `pre-push` to parent monorepo via `pnpm exec lefthook run <hook>`
- No CI/CD pipeline in this repository (no `.github/workflows/`)
- No containerization
- No monitoring or logging infrastructure
