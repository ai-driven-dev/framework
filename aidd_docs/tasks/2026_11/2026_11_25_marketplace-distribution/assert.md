# Assert: Release marketplace distribution

## Round 1

- Head: `60ccf359f`
- Uncommitted changes: yes
- Verdict: FAIL

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | 1 | The CLI capability check exceeded 5 seconds. The shell parser's performance test took 192 ms against a 100 ms budget. |
| `make check` | 2 | The CLI capability check exceeded 5 seconds on both Node 24 and Node 22. |

## Round 2

- Head: `b0ab7d085`
- Uncommitted changes: no
- Verdict: PASS

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm --dir cli test:arch` | 0 | |
| `node --test scripts/__tests__/common-rules.test.js` | 0 | |
| `node --test scripts/__tests__/release-recap.test.js` | 0 | |
| `node scripts/validate-yaml.mjs .github/workflows/ci.yml .github/workflows/marketplace-dry-run.yml` | 0 | |
| `node scripts/check/run.cjs` | 0 | |
| `git diff --check` | 0 | |
