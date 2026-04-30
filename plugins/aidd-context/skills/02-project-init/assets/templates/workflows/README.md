# workflows/ — Procedural Recipes

## What is workflows/?

`workflows/` contains step-by-step procedural guides for recurring development operations. Each file is a single workflow — a numbered sequence of commands or actions to complete a well-defined task.

## File naming

Use the workflow name, lowercase, hyphenated:

- `deploy-staging.md`
- `db-migration.md`
- `create-feature-branch.md`

## What belongs here?

- Multi-step operations that are error-prone if done ad-hoc
- Runbooks for ops tasks (deploys, rollbacks, migrations)
- Onboarding steps that must be done in order

## Format

Each workflow file should contain:

1. **Goal** — one sentence describing the end state
2. **Prerequisites** — what must be true before starting
3. **Steps** — numbered, each step is one action with its command
4. **Verification** — how to confirm the workflow succeeded

Keep workflows short. If a workflow exceeds 15 steps, split it into two files.
