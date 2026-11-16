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
