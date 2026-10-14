# Review: backlog-shape-guard

- **Verdict**: changes-requested
- **Diff**: `origin/next...d0e3ea96`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_07
- **Findings**: 0 critical, 5 warning, 6 minor

## Phases

### Phase 1 — the taught example is parsed where it is watched

- [x] the guard passes over a broken example before the change, recorded — `7f77e845` body ("the guard passed 3 of 3"); reproduced: `origin/next`'s guard returns `pass 3 / fail 0` over a syntax-broken asset and over a syntax-broken fence in `04-plan.md`
- [x] the guard parses both the fenced and the asset form, and names file and field on failure — `scripts/__tests__/a-backlog-link-the-reader-can-read.test.js:74-88`; measured `teaches an example that is not JSON: Expected ',' or '}' ... position 94` and `must teach the field "written_by" as a non-empty string`
- [ ] three mutations each turn this guard red, and the suite is green once restored — two of the plan's three discriminate. The third, `phase-1.md:35` "rename the taught file", also fails at `origin/next` (`ENOENT`, 1 failure): `fs.readFileSync` is unchanged context in the diff, so it proves nothing about the new assertion. Suite green once restored: `tests 550 / pass 550 / fail 0`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | functional | 1 | `scripts/__tests__/a-backlog-link-the-reader-can-read.test.js:73` | Criterion 3 unmet: the renamed-asset mutation fails identically at `origin/next`, so only 2 of 3 named mutations discriminate. `aidd_docs/memory/coding-assertions.md`: "Break the thing the test is named for and watch that test — not another — go red" | Swap it for the mutation that does discriminate: strip the fence markers from `04-plan.md` keeping the JSON lines as prose. Measured: `origin/next` 0 failures, current guard fails `must teach the example in a json fence` |
| 🟡 | fit | 1 | `:74-75` (`d0e3ea96`) | The stated reason for dropping the one-fence rule — it "would have failed a contributor adding an unrelated json block to 04-plan.md with a message about a rule they never read" — does not hold for a fence added *above* the example. Measured: the guard still fails, now with `04-plan.md must teach the field "backlog" as a non-empty string`, against a file that does teach it. The removal only helps a fence added *below* | Select the fence by content (the first whose parse carries `backlog`) rather than by position; both the explanatory message and the below-case then hold |
| 🟡 | fit | - | `cli/tests/contexts/telemetry/infrastructure/task-backlog-skill-shape.integration.test.ts:71,88` | #972's named harm is still reachable. Measured: a plugins-only edit changing the asset's `backlog` to `owner/repo#999`, or adding a fourth field to one taught file only, leaves this guard green (`pass 3 / fail 0`) and turns the `cli/` test red (`expected 'owner/repo#999' to be 'owner/repo#123'`; `expected [ 'backlog', 'note', …] to deeply equal [ 'backlog', 'written_at', …]`). No gate runs the `cli/` test on those paths | Drop the over-specified value pin, or move field-set agreement between the two taught files into this guard |
| 🟡 | conform | 1 | `7f77e845` commit body | Claims "a renamed asset" among the mutations proving the new guard. The pre-change guard fails on it too, so it is not proof. `coding-assertions.md`: "Never state in a commit message or a report anything not just observed in output" | Reword to the two mutations that discriminate, plus the fence-absence one |
| 🟡 | conform | 1 | `plan.md:3`, `phase-1.md:2` | Both still `status: pending` with every line of the phase shipped. `plugins/aidd-dev/skills/02-implement/actions/02-execute.md:17` requires `status: done` committed with the code; `03-finalize.md:7` needs all phases done | Set both to `done` |
| 🟢 | fit | 1 | `:74` | The residual weakness `d0e3ea96` accepts is real and shared by both guards. Measured: a valid-shape json fence above the taught example lets a *broken* taught example pass the scripts guard (`pass 3`) and the `cli/` test (`5 passed`). Nothing lands red on `next`, so the hole is in the guard's purpose, not in gate coverage | Covered by the content-selection fix above |
| 🟢 | rot | - | `source.md` Observed behaviour; `7f77e845` body | Overstates the gap for the `.json` half: pre-commit `json-validity` (`lefthook.yml:5`, glob `**/*.json`) already failed a syntax-broken asset — `invalid JSON (Expected ',' or '}' ...)`, exit 1. The genuinely new pre-commit coverage is the `.md` fence cases and empty or non-string field values | Scope the claim to the `.md` fence and the field-value cases |
| 🟢 | rot | 1 | `phase-1.md:41-57,69` | The shipped fence-presence assertion (`:75`) appears in no task, test-scope leg or criterion; nor does the one-fence rule added by `bd05645f` and removed by `d0e3ea96`. Task 2 step 4 covers only "both forms readable" | Add the fence-absence leg to Test Scope and criterion 3 |
| 🟢 | code | 1 | `:74` | 104 chars, where the surrounding code breaks such expressions across lines. Nothing enforces it: `biome.json` exists only under `cli/` | Split the ternary |
| 🟢 | code | 1 | `:75` | `assert.ok(source !== undefined, ...)` can never fire on the `.json` branch (`source = text`, always a string), so its message would be wrong if it did | Scope the assertion to the `.md` branch |
| 🟢 | code | 1 | `:81` | A taught file holding literal `null` fails with `TypeError: Cannot read properties of null (reading 'backlog')`, naming no file, where arrays and primitives fail cleanly. The reader absorbs this case (`asPlainObjectOrEmpty`) | Guard the parse result as a plain object before the field loop |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 67% (2/3)                                         |
| Files checked | `scripts/__tests__/a-backlog-link-the-reader-can-read.test.js`, `plugins/aidd-pm/skills/04-spec/assets/backlog-link-template.json`, `plugins/aidd-dev/skills/01-plan/actions/04-plan.md`, `cli/src/contexts/telemetry/infrastructure/task-backlog-adapter.ts`, `cli/src/contexts/telemetry/domain/task-backlog-link.ts`, `cli/tests/contexts/telemetry/infrastructure/task-backlog-skill-shape.integration.test.ts`, `lefthook.yml`, `.github/workflows/cli-ci.yml`, `.github/workflows/validate.yml`, `scripts/validate-json.mjs`, `plan.md`, `phase-1.md`, `backlog-link.json` |
| Unchecked     | criterion 3, three discriminating mutations — fix |
| Unplanned     | the fence-presence assertion (`:75`); the one-fence rule added by `bd05645f` and removed by `d0e3ea96`, in no plan document; `backlog-link.json` added by `6f021da4`, absent from the phase projection |
