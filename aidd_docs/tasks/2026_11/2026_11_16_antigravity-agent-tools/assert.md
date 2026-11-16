# Assert: Antigravity agents emitted with agy tool names

## Round 1

- Head: `184d2f882`
- Uncommitted changes: yes
- Verdict: FAIL

| Check | Exit | Failure |
| --- | --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | 1 | `markdown-links`: `❌ Links: 6 broken in 1502 files`, all under the gitignored `temp/gemini-flat/`; `scripts-tests`: `ℹ fail 5`, `a real aidd is on the test PATH` and four others outside this change |
| `pnpm exec lefthook run pre-push` | 0 | |

Both ran with `npm_config_manage_package_manager_versions=false`: the pinned pnpm 12.16.1 is missing on this machine (`Failed to switch pnpm to v12.16.1`), so pnpm 10.17.1 ran them. `pnpm exec commitlint --edit` not run: nothing is committed.

## Round 2

- Head: `769e0d899`
- Uncommitted changes: no, in scope
- Verdict: PASS, with one environment caveat

| Check | Exit | Failure |
| --- | --- | --- |
| commit hooks (pre-commit on the staged files, commitlint) at `9e861e645` and `769e0d899` | 0 | |
| `pnpm exec lefthook run pre-push` on both pushes | 0 | |
| `pnpm exec lefthook run pre-commit --all-files` | 1 | `scripts-tests`: two telemetry tests, `a real aidd is on the test PATH`; they fail the same way on a clean `origin/next` worktree and pass under the git hook, so they depend on an `aidd` installed on this machine, not on this change |

The gitignored `temp/` behind round 1's link failures was moved out of the repository. Runs used `npm_config_manage_package_manager_versions=false`, as in round 1.
