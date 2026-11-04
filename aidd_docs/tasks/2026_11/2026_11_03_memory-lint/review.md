# Review: Memory lint

## Round 1

- Diff: `origin/next...4f7dbee26`
- Uncommitted changes: yes (`plan.md` status, `run.md`)
- Axes: code, functional, relevancy
- Verdict: changes-requested, because the new hook crashes on load in any project declaring `"type": "module"` once copied into it (Cursor), breaking the plan's "exit 0 whatever happens"

### Criteria

- [x] 1.1 the four phase-order scenarios, existing validator tests kept — `scripts/__tests__/validate-plan.test.js:181-197`, `validate-plan.cjs` `phasesProblems`
- [x] 2.1 delete-then-create valid, delete-then-modify refused — `validate-plan.test.js:187-191`, `validate-plan.cjs` `phaseReport` drops recreated paths from `deleted`
- [x] 2.2 assert runs the pre-commit and reports its exit code — `run.md` 2.2 on this head, `03-assert/actions/01-assert.md:17`
- [x] 3.1 M1 to M7 report their fixture, no look-alike — `scripts/__tests__/memory-lint.test.js:39-130`
- [x] 3.2 README skipped, throwing rule is one problem, exit 1 only with an error — `memory-lint.test.js:143-205`
- [x] 3.3 every error on the repository's banks a true breach — `run.md` 3.3 on this head
- [x] 4.1 each payload shape yields the file's problems, nothing else outputs, exit 0, only `node:fs`/`node:path` — `scripts/__tests__/memory-hook.test.js:50-200`, for the scenarios the phase lists
- [x] 4.2 both groups in `hooks.json`, both catalogs list the hook — `plugins/aidd-context/hooks/hooks.json:13-24`, `docs/CATALOG.md`, `plugins/aidd-context/CATALOG.md`
- [x] 4.3 scripts suite and pre-commit pass — `run.md` 4.3 on this head
- [x] 5.2 each hook format in its profile, bridges share one shape — `profiles/*/hooks-format.ts`, `formats/plugin-hooks-shape.ts`
- [x] 5.3 no application file imports a Cursor module; `project` without a format refused — no `profiles/cursor` or `cursor-hooks` import under `cli/src/contexts/*/application`, `plugins-capability.ts:329-333`
- [x] 5.4 tests unchanged in what they assert, `golden.json` identical — `run.md` 5.4 (`dc68dc5b…` before and after), moved code matches `origin/next:…/flat-hooks-merge.ts`
- [x] 5.5 matched group's Cursor entries carry the matcher, `translate/domain/formats/cursor-hooks.ts` unchanged — `profiles/cursor/hooks-format.ts:61-73`, file absent from the diff
- [x] 5.6 CLI suite, mutation scopes, pre-commit, pre-push — `run.md` 5.6 on this head
- Unverified at runtime: 5.1 the identifier baseline lists only what #1143 owns — needs #1143's scope read against `IDENTIFIER_BASELINE`

### Assumptions

- The hook's scripts run as CommonJS wherever they land — finding: Cursor copies them into the project (`profiles/cursor/hooks-format.ts:77,112-119`), where the project's `package.json` decides, as `plugins/aidd-context/hooks/update_memory.js:229-231` already warns
- Every path the hook reads arrives as `tool_input.file_path`, `tool_input.path` or a patch header — holds for the shapes the plan measured, checked at `memory-hook.js:24-30`
- The project root is the bank's parent — holds when the session's `cwd` is the root; a session `cd`'d into a subfolder misses the root bank silently, checked at `memory-hook.js:34-37,47-50`
- An older Cursor install's matcherless entries still digest-match on reinstall and removal — holds, `remove-project-hooks.ts` compares recorded digests of the file's current entries, covered by `project-hooks-materializer.unit.test.ts` and `remove-project-hooks.unit.test.ts`
- The move changes no output — holds, old `flat-hooks-merge.ts` and the new `profiles/*/hooks-format.ts` match line for line apart from type names and Cursor's matcher

### Findings

- `plugins/aidd-context/hooks/memory-hook.js:3-5` (and `memory-lint.js:10-12`, `lib/memory-rules.js`): CommonJS `require` in `.js` files that `aidd plugin install` copies into `.cursor/hooks/aidd-context/`; in a project whose `package.json` declares `"type": "module"` Node parses them as ESM and the hook dies on load (`ReferenceError: require is not defined in ES module scope`, exit 1, stack trace on stderr) after every Write, before the `try` at `memory-hook.js:74` can catch it. Proof `profiles/cursor/hooks-format.ts:112-119` puts the scripts in the project; `update_memory.js:229-231` records this exact crash and avoids it; `plugins/aidd-ui/hooks/ui-hook.cjs` avoids it by extension → rename the three files to `.cjs` (update `hooks.json`, the two requires, the tests and catalogs), and add a hook test run under a `"type": "module"` `package.json` — 🟡 major
- `cli/src/contexts/framework/application/framework/translator/project-hooks-materializer.ts:114`: application code still names Cursor in its refusal message, which the identifier guardrail ignores since it strips strings, proof `tool-addition-cost.arch.test.ts` `toolIdentifiersIn` → say "hook script" without the tool — 🟢 minor
- `scripts/__tests__/memory-hook.test.js`: phase 4's "an engine that throws" scenario has no test; only invalid JSON and a missing file are covered, proof `phase-4.md` Test Scope → inject a throwing rule or a broken engine and assert no output, exit 0 — 🟢 minor

### Limits

- Cursor entries drop the plugin's `timeout: 5` (`profiles/cursor/hooks-format.ts:61-73`), as before this branch — Cursor's default hook timeout would settle whether a slow bank can stall a turn
- Copilot's payload shape (`tool_result`, `tool_input.path`) is copied from `aidd-ui`, not measured in this plan — a live Copilot write would settle it
- OpenCode and Kilo receive the new `PostToolUse` group through their bridges, and the plan claims neither — a live write on each would show whether the hook stays silent there
- The ESM crash was confirmed by piping a Cursor payload into a scratch copy of the hook under a `"type": "module"` `package.json`, outside the project; the finding stands on the static proof alone
