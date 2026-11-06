# Run

## Run 1

Head: 9db5c887bc58093237dd16c9aa5fb6707b2a36d6

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | Happy path: `writeProject` passes records and history, `node scripts/check-tests-leave-git-alone.js -- node --test scripts/__tests__/aidd-ui-records.test.js` | 54 of 54 pass |
| 1.2 | R1: a malformed front matter line, same command | one problem naming line 7 |
| 1.3 | `load` without `aidd_docs/ui/`, and on the fixture, same command | `null`; 10 records |
| 1.4 | R1 to R16, one mutation each, same command | one message per rule |
| 1.5 | H1 to H6, one mutation each, same command | one message per rule; H2 names version 2 |
| 1.6 | each rule dropped from `RULES` in turn, then the file rerun | only that rule's tests red, 22 of 22 rules |
| 2.1 | T1 to T8, `node scripts/check-tests-leave-git-alone.js -- node --test scripts/__tests__/aidd-ui-tokens-renders.test.js` | one message per rule, 33 of 33 pass |
| 2.2 | V1 to V6, same command | one message per rule; `ltr` alone allows `margin-left` |
| 2.3 | each rule dropped in turn, then the file rerun | only that rule's tests red, 14 of 14 rules |
| 3.1 | C1 and C2, `node scripts/check-tests-leave-git-alone.js -- node --test scripts/__tests__/aidd-ui-code.test.js` | absent file, absent export, malformed link and undeclared package each named, 14 of 14 pass |
| 3.2 | C3 to C6, same command | orphan, colour, unit, shared link and physical property named; ignored file and script units silent |
| 3.3 | each rule dropped in turn, then the file rerun | only that rule's tests red, 7 of 7 rules |
| 4.1 | `node plugins/aidd-ui/hooks/validate-ui.cjs <tmp>`, `node scripts/check-tests-leave-git-alone.js -- node --test scripts/__tests__/aidd-ui-validate.test.js` | `VALID` exit 0; one line per family, exit 1; nothing without `aidd_docs/ui/` |
| 4.2 | E3 to E5 hook payloads on stdin, same command | exit 2 with the lines on stderr under `aidd_docs/ui/` and `src/ui/`; silent elsewhere; SessionStart prints the count; silent on bad stdin and on a throw |
| 4.3 | path filter, exit 2, silent catch and each check reverted in turn | each turns its own test red, 13 of 13 pass restored |
| 4.4 | `node scripts/sync-generated-docs.mjs --check`, `sh scripts/summarize-plugin-catalogs.sh` | in sync; `docs/CATALOG.md` lists `hooks/ui-hook.cjs` under both events |
| 4.5 | `make check`; `pnpm exec lefthook run pre-commit --all-files --force`; `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | `make check` exit 0, every job skipped with nothing staged; whole tree: 870 of 871 pass, the one failure names untracked `hooks/ui-hook.cjs`, and it passes with the new files tracked in a scratch index |

Left: nothing committed (commit strategy `never`); `comments-name-files-that-exist` stays red until `plugins/aidd-ui/hooks/` is tracked; `plugins/aidd-ui/CATALOG.md` lists `hooks.json` only, because its generator skips `.cjs` files, as for `aidd-telemetry`.
