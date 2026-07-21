# Part 5 — Real-network CI E2E

> Nightly CI workflow that runs `aidd setup --source remote` against the real GitHub framework repo. Catches URL drift, fetch regressions, auth token plumbing, and real marketplace catalog installs.

## Pre-requisites

- Part 4 (stable release) recommended — run network E2E against stable published binary, not dev build
- GitHub secret `AIDD_TEST_PAT` provisioned in repo settings (fine-grained, read-only on `ai-driven-dev/framework`)
- Existing `ci.yml` not modified — this is a new separate workflow file

## Goal

All current E2E tests run against a local fixture framework repo (`tests/fixtures/aidd-framework/`). This does not catch:

1. Default marketplace URL (`https://github.com/ai-driven-dev/framework.git`) drifting or becoming unreachable
2. Authentication token plumbing regressions (gh CLI, GITHUB_TOKEN env)
3. Real `marketplace.json` schema changes in the framework repo
4. Plugin install from real catalog (real plugin IDs, real file content)

The nightly workflow runs once per day on `main`, using real network, and reports failures as GitHub check failures.

## Architecture compliance

No source code changes. This part is infrastructure-only (CI workflow + vitest config gate).

### Gate mechanism

Network tests are gated by `process.env.RUN_NETWORK_TESTS === "1"`. Tests are skipped in local `pnpm test` runs by default. The nightly workflow sets this env var.

```typescript
// tests/e2e/network-setup.e2e.test.ts
const runNetwork = process.env.RUN_NETWORK_TESTS === "1";
describe.skipIf(!runNetwork)("network E2E — real GitHub", () => { ... });
```

This keeps the unit/integration/E2E test counts within the ≤6 E2E budget for regular CI.

## Steps

### A. Create GitHub Actions workflow

- [ ] Create `.github/workflows/network-e2e.yml`
- [ ] Trigger: `schedule: - cron: "0 4 * * *"` (04:00 UTC daily) + `workflow_dispatch`
- [ ] Runner: `ubuntu-latest`
- [ ] Node: `24`
- [ ] Steps:
  1. Checkout
  2. pnpm install + build
  3. Set `RUN_NETWORK_TESTS=1` env
  4. `pnpm test:e2e` (runs network E2E tests)
- [ ] Set secret: `AIDD_TEST_PAT` (optional — only needed for private framework repos)
- [ ] On failure: create a GitHub issue or send notification (optional, document as open question)

### B. Create network E2E test file

- [ ] Create `tests/e2e/network-setup.e2e.test.ts`
- [ ] Test 1: `aidd setup --source remote --all --no-plugins --yes` against default URL
  - Assert exit code 0
  - Assert `.aidd/manifest.json` created with `tools` populated
  - Assert at least one tool config file written
- [ ] Test 2: `aidd marketplace cache refresh` — assert cache populated from real URL
- [ ] Test 3: `aidd plugin list` — assert at least one plugin returned from real catalog
- [ ] Test 4 (optional, gated on `AIDD_TEST_PAT`): `aidd setup --source remote --all --recommended-plugins --yes` — real plugin install

### C. Update vitest config

- [ ] Confirm `vitest.config.ts` `e2e` project does not exclude network tests (they are opt-in via env)
- [ ] Document: `RUN_NETWORK_TESTS=1 pnpm test:e2e` to run network tests locally

### D. Smoke test the workflow locally

- [ ] Run `RUN_NETWORK_TESTS=1 pnpm test:e2e` locally — confirm all 3 network tests pass against real GitHub
- [ ] Record baseline runtimes (expect ~30–60s total)

## Tests

### Network E2E tests (4, gated by env)

- `network-setup.e2e.test.ts` — 4 describe blocks (setup, cache, list, plugin install)
- These count against E2E budget only when `RUN_NETWORK_TESTS=1` — not counted in regular CI

### No new unit or integration tests

## Acceptance criteria

- [ ] `.github/workflows/network-e2e.yml` exists and is valid YAML (`act` or GitHub UI validation)
- [ ] `pnpm test:e2e` (without `RUN_NETWORK_TESTS`) completes without running network tests
- [ ] `RUN_NETWORK_TESTS=1 pnpm test:e2e` passes all 3+ network tests locally
- [ ] Nightly workflow triggers at scheduled time (verify in GitHub Actions UI after merge)
- [ ] Workflow failure does NOT block regular CI (separate workflow, no dependency in `ci.yml`)
- [ ] Secret `AIDD_TEST_PAT` documented in repo README / contributing guide

## Manual validation

```bash
# Local network test run (requires internet access)
RUN_NETWORK_TESTS=1 pnpm test:e2e
# expect: 4 passing network E2E tests + regular E2E tests

# Verify regular CI is unaffected
pnpm test:e2e
# expect: network tests skipped, regular E2E pass
```

## Risks / breaking changes

- Network tests are flaky by definition — framework repo may be temporarily unavailable; add retry logic (vitest `retry: 2` per test)
- Rate limiting: GitHub API rate limit on unauthenticated requests; use `AIDD_TEST_PAT` if tests fail intermittently
- Cost: nightly workflow consumes GitHub Actions minutes; acceptable for public repo (unlimited for public)
- Open question: should workflow failure auto-open a GitHub issue? Adds complexity; defer to separate follow-up

## Effort

SMALL — ~1 day.

## Commit

```
ci(network-e2e): nightly workflow + gated network E2E tests

Add .github/workflows/network-e2e.yml running daily at 04:00 UTC.
Tests aidd setup --source remote against real GitHub framework repo.
Gated by RUN_NETWORK_TESTS=1 env to avoid running in regular CI.
Covers: default URL reachability, cache refresh, plugin list, install.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-5-network-e2e.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
