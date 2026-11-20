# Run: Artifact check at turn end, tranche 2a

## Run 1

- Head: `ada1172bb`
- Left: none. Deviations from the plan: DOC-01 skips `plugins/*/hooks/lib/contracts/`, and `docs/CATALOG.md` gained hook extras for aidd-dev and aidd-pm, both forced by the generated copies. Shell-marked Stop over 10000 files under scope measured 2.8 s on aidd-dev.

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | engine accepts and validates `scope`: `node --test scripts/__tests__/check/engine.test.js` | pass |
| 1.2 | each contract declares its scope: `node --test scripts/__tests__/check/skill-contract.test.js` | pass |
| 1.3 | SKILL-22 judges plugin skills only: `node --test scripts/__tests__/check/skill-contract.test.js` | pass |
| 1.4 | engine copies resynced: `node scripts/check/engine/sync.cjs --check` | exit 0, nothing printed |
| 2.1 | one handler source, all hosts: `node --test scripts/__tests__/artifact-hook.test.js` | 48 pass |
| 2.2 | stale and orphan copies named, then repaired: `node --test scripts/__tests__/check/sync.test.js scripts/__tests__/check/run.test.js` | pass; editing `phase-template.md` makes `sync.cjs --check` and `run.cjs` name the hook copy |
| 2.3 | aidd-dev and aidd-pm wired without HOOKS-01, HOOKS-02 or REPO-06 findings: `node scripts/check/run.cjs` | exit 0, nothing printed |
| 2.4 | tests and timing: `node --test scripts/__tests__/artifact-hook.test.js scripts/__tests__/check/*.test.js`, a `run.md` Stop and a shell-marked Stop timed | pass; 0.11 s and 2.8 s, under 5 s |
| 3.1 | one Stop answer holds the AGENT finding and memory's text: `node --test scripts/__tests__/memory-hook.test.js scripts/__tests__/artifact-hook.test.js` | 80 pass |
| 3.2 | merged answer and context artifacts on six hosts: same command | pass |
| 3.3 | Hooks section names the three plugins and the single Stop entry: `node scripts/check/run.cjs` | exit 0, nothing printed |
| 3.4 | `node scripts/check/run.cjs`, `node scripts/check/engine/sync.cjs --check`, `node --test 'scripts/__tests__/**/*.test.js'` | exit 0, exit 0, 2031 pass, 0 fail |
