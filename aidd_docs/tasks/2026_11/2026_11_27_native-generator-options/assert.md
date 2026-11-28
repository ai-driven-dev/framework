# Assert: Native generator options

## Round 1

- Head: `7839784e2`
- Uncommitted changes: yes
- Verdict: PASS

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | 0 | |
| `node --test scripts/__tests__/scaffold-skill.test.js` | 0 | |
| `git diff --check` | 0 | |
