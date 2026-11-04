# Run: Memory lint

## Run 1

- Head: `4f7dbee26`
- Left: the cases that stay out of reach are stated in the plan: a file written through a shell command never reaches a write hook, and Cursor's `stop` does not fire in a headless run

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | a later phase modifies or deletes what an earlier one creates, refuses what an earlier one deletes: `validate-plan.test.js` under the wrapped scripts suite | 38 validator tests pass |
| 2.1 | a file deleted then recreated is valid again: the three-phase case in `validate-plan.test.js` | red before the fix, green after |
| 2.2 | assert runs each project check as written: `pnpm exec lefthook run pre-commit --all-files` | 0 jobs skipped |
| 3.1 | each rule M1 to M7 fires on its fixture and not on its look-alikes: `memory-lint.test.js` | green; raising the M5 limit turns 3 tests red |
| 3.2 | the engine skips README.md and `internal/`, a throwing rule is one named problem, exit 1 only with an error: `memory-lint.test.js` | green |
| 3.3 | every error on this repository's banks is a true breach: `node plugins/aidd-context/hooks/memory-lint.js .` and `… cli` | two false positives turned into fixtures and fixed |
| 4.1 | each host payload yields the written file's problems, any other input no output, exit 0: `memory-hook.test.js` | 13 tests green; removing the bank filter turns the no-read test red |
| 4.2 | `hooks.json` gains the `PostToolUse` group, `SessionStart` unchanged, catalogs regenerated: the pre-commit `--all-files` | exit 0 |
| 4.3 | the scripts suite and the gates: wrapped `node --test`, pre-commit `--all-files`, pre-push | 1002 tests, exit 0 |
| 5.1 | a tool-named identifier under `application/` or `domain/formats/` fails: `tool-addition-cost.arch.test.ts` with a probe | probe red, baseline 19 files |
| 5.2 | each hook format lives in its profile, the bridges share one source shape: `cd cli && pnpm test` | 47 moved tests kept, suite green |
| 5.3 | the application takes the project-hooks format from the capability: `plugins-capability.unit.test.ts` | a `project` destination without a format fails at construction |
| 5.4 | no behaviour changed by the move: `shasum cli/tests/golden/snapshots/framework-build/golden.json` | `dc68dc5b…` before and after |
| 5.5 | Cursor entries keep their matcher, reinstall and removal unchanged: the Cursor hooks-format, materializer and removal tests | 3 tests red before, 6884 passed after |
| 5.6 | the CLI gates: `pnpm test`, the touched mutation scopes, pre-commit `--all-files`, pre-push | every scope at or above its floor, `tools-cursor` 98.1 for 97; exit 0 |
