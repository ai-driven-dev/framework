# Run: aidd-ui 4a, restructuration

Evidence for slice 4a: the baseline, the final pilot, the defects the pilot found, and the mutation of each guard.

Pilot lines, one per project, from `scripts/aidd-ui-pilot.cjs` (Haiku, restricted tools, the chain of the skills on throwaway copies). Errors, wireframes, code and steps are compared; warnings follow the model's choices and do not count. The superseded pilot blocks are in git history.

## Baseline

Skills of `origin/next` before the restructuration: the journeys skill, then the system skill receiving brand, foundations and components together. Fresh copies; the chats of every copy were deleted by the script.

```txt
blank errors none warnings none wireframes all code untouched
gouvernail errors none warnings C3,R18,V6 wireframes all code untouched
kairos errors C10 warnings C3,R18,V6 wireframes all code untouched
```

## Final

<!-- final pilot lines on HEAD go here -->

## Defects the pilot found

- Extract key collision, `C10` on Kairos. Cause: `readScript` dropped each export's name, so two exports sharing a key wrote one token and the last won (49 `C10` lines when the model picked `apps/mobile/shared/ui/tokens.ts`). Fix 776cf6fe6: a shared key keeps its export's name. Proof: two Kairos runs on the colliding file, no error; two earlier baseline runs showed no `C10`, so it was not constant.
- Owed `H1` rows and owed tables. Cause: the model took the owed `H1` for a later step's and never recorded the journeys and wireframes; owed tables then listed problems the skill's own steps clear. Fixes f02e57981, 92f383a27, 2b163c4e9: "record in the history", owed split by owner, conclude keeps only what another skill owes. Proof: Kairos `errors H1` once, none on the next runs; the owed-table tests.
- Primitive against semantic groups, `T8` on blank (99 lines). Cause: nothing said semantic tokens sit in groups `primitives` omits, so the model listed every group as primitive and each component cited a primitive. Fix 2b163c4e9: `tokens.md`, the system template and the `T8` fix say it. Proof: blank rerun on the same text, no error.
- Pilot suffix, `decisions.md`. Cause: the suffix said "say which" for each choice and the model logged them in `aidd_docs/tasks/<part>/decisions.md`, so blank ended `code changed 2 steps broken 2`. Fix a82a3acb8: state each choice in the reply, write no file the skill does not name. Proof: two blank runs, `steps ok`.
- `GIT_*` leak in the pilot test. Cause: a hook sets `GIT_DIR` and `GIT_INDEX_FILE`, which aimed the pilot's git calls at the caller's repository. Fix f2a832b21: the pilot and its test run git without any `GIT_*` variable. Proof: the mutation below and `acts on its own repositories, never on the one GIT_DIR names`.

## Size

Words in the skills (`cat plugins/aidd-ui/skills/*/*.md plugins/aidd-ui/skills/*/*/*.md | wc -w`): 5922 before the restructuration, 4751 after the review, 5043 before the last lean pass, 4958 after it.

## Mutations

Each guard was broken once and its own test watched going red. A "survived" note says what the first test missed and what closed it.

| Guard | Mutation | Result |
| --- | --- | --- |
| `changedOutsideUi` | returns `[]`; the `aidd_docs/ui/` exclusion dropped | killed |
| `copyProject` | copies the working tree, not `git archive HEAD`; writes a file into the source; keeps the `GIT_*` variables | killed |
| `verdict` | keeps duplicate ids; keeps ids unsorted; counts a warning as an error; counts an error as a warning | killed |
| `stepsWithoutWireframe` | returns `[]`; `null` back to `[]` when nothing loads or no step exists | killed |
| `snapshot` | follows a link to a folder | killed |
| chat folders | the copy's last folder name alone; a name containing the copy's folder names, not ending with them | killed |
| pilot arguments | `--only` ignored; `--only` naming no pilot returns the empty list; missing-checkout guard removed; the two checkouts swapped | killed |
| pilot chain | brand, foundations and components in one request; every step's task folder named `system` | killed |
| pilot run | the `catch` rethrows | killed, only the thrown-step test fails |
| pilot exit | the `broken` check dropped from the exit code | killed |
| pilot exit | the `missing === null` check dropped | survived while the chain also left an error; killed once the test leaves no other problem |
| `reportLine` | no `no journey` wording | killed |
| blank pilot requests | `web and mobile` back in the brand request; gone from the foundations request | killed |
| pilot request suffix | `write no file the skill does not name` dropped | killed |
| pilot step files | a changed, a deleted, or an untouched file miscounted | killed |
| `ENGINE_FILES` | allowed for every step again | killed: `names a step that wrote an engine file it does not drive` |
| `ENGINE_FILES` | `history.md` for `02-brand`, `tokens.css` for `01-journeys`, `code-debt.json` for `04-components`, `tokens.resolver.json` dropped from `03-foundations` | each killed: `lets each skill's step drive only these engine files` (first they survived: the test derived its expectation from the table itself) |
| twelve-word test | the rejected brand sentence re-added to `02-brand/actions/02-write.md` | killed |
| twelve-word test | a three-clause line of 21 words joined by `;` | passes when the test also splits on `;`; killed by the split on `.` `!` `?` alone |
| level `organism` | `composition` kept in `KIND_KEYS` and `FOLDER_KINDS`; `molecule` and `organism` swapped in `LEVELS` | killed |
| skills | a fifth folder under `skills/` | killed |
| one author per kind | `brand-template.md` copied into `03-foundations/assets/` | killed |
| a skill names no other | `02-brand` names `03-foundations` in an action | killed |
| export name for a shared key | never kept (`shared = false`) | killed, only the shared-key test fails |
| export name for a shared key | always kept (`shared = true`) | killed, 10 tests fail |
| `engine.md` | the Output block pasted back into one | killed |
| `engine.md` | a `## Commands` list put back in one | killed: `hold the install table, the step table and the owed table` |
| `engine.md` | `valdate` in the command of a step row | killed: `run only commands the engine's help knows` |
| `engine.md` repeats `help` | a verbatim `help` sentence pasted in `04-components`; the `left` sentence of `help bump` in `03-foundations` | killed: `repeat no sentence of the engine's help` (cut at "With ids," it survived: the sentence compared must be whole) |
| `stepBreaks` | returns `[]`; an engine file left out of the allowed set | killed |
| owned set pinned to its line | `platforms/` dropped from the `03-foundations` line | killed |
| `BRAND_HEADINGS` | `Platforms` back | killed |
| system answers | the README line back in step 2 of `02-write.md`; the `platforms` row of `extraction.md` removed | killed |
| actions free of commands | `node <engine> validate`, `--root`, or a code fence put back in `02-brand/actions/03-conclude.md` | killed, one disjunct each |
| publish line | removed from `03-foundations/references/engine.md`; removed from `04-components/references/reply.md` | killed |
| `wireframes.md` | `warning R18` made `warning` | killed |
| step table | `write 3` made `write 5` in `01-journeys`; `write 4` made `write 2` | killed, the first written red |
| owed table | `H1`, `C4`, `T6` or `T10` rows put back in the skill whose step clears them, or owed by another skill | killed: `owe to another skill no problem that a step of the same skill clears` |
| owed table | `T1` owed by another skill in `03-foundations`; `V1` in `04-components` | killed: that test and `say, for what its own write clears, that this skill owes it` |
| owed table | the `T1` row dropped from `03-foundations` | killed: `say, for what its own write clears, that this skill owes it` |
| actions keep owed errors | a conclude or step 6 back to "a later step owes" | killed: `keep, in an action, only the errors another skill owes` |
| `SKILL.md` boundary | "The engine writes" back in `03-foundations` or `04-components`; "never in the code" back in `01-journeys` or `02-brand` | killed: `state the write boundary once...` |
| reference files | `code-errors.md` copied back into `03-foundations` and `04-components`; `reply.md` of `03-foundations` over the one of `04-components` | killed: `hold no reference file twice, byte for byte` |
| task folder | sentence dropped from `03-foundations`; "must exist" in `01-journeys`; "The folder may be absent" in `04-components` (pin loosened to the fact) | killed, killed, passes (as wanted): `say, where a task folder is taken, that it may be absent` |
| elements | the path link sentence dropped | killed, written red first |
| elements | the `focus` sentence dropped; "only if the element itself takes focus" dropped (the pin was loosened to the fact) | killed, killed: the `states` row must name `focus`, `itself` and `it uses` |
| ignore ownership | `ignore` of the 03 C3 row replaced by `nothing`; the 04 C3 row writes `ignore` in place of naming it to the user; `ignore` added to a `02-brand` reference | killed, killed, killed: `give the ignore of an unlinked file to the foundations alone...` |
| `help` entries | one dropped; one renamed | killed |
| `help` | `help <unknown>` exits 0; `commandList()` no longer printed for `help` alone | killed |
| `help` words | a sentence of 13 words | killed |
| `help` exits | a code declared and never returned (`2` on `validate`); the `1` of `validate` dropped | killed: `declares the exit codes each command returns, and no other` |
| exit code | `validate` or `tokens` blocked returns `EXIT_USAGE` (2) in place of 1 | killed |
| `help` lines | the count, error or warning line shape dropped from `validate`; the engine prints no `warning` word | killed: `shows the count line, the error line and the warning line as validate prints them` |
| `help` lines | `ERROR_LINE` with the rule before the file; `COUNT_LINE` plural only | killed: same test (the real line says `1 warning`, so the shape became `error(s)`, `warning(s)`) |
| `help` lines | `WARNING_LINE` without the word `warning` | survived while the test only matched warnings; killed once an error line must not match the warning shape |
| `help` grouped line | added to `validate` or `impact`; dropped from `hook` | killed: `shows the grouped line of the hook alone` |
| `help` facts | `bump --created` refusals, `extract` refusals or `validate` "ungrouped" dropped | killed, `bump --created` written red first |
| `help` code rules | the "about the code" sentence dropped, or `C3` added | killed: `names, as about the code, the errors validate reports...` |
| `help` bump | `--task` no longer said never written; the `why` sentence dropped or reworded | killed: `says what bump leaves as it prints it...` |
| `help` bump | "the elements reached and not raised" back | survived while the test pinned `why` alone; killed once it checks that a screen is left and the line names no element |
| `help` extract | `tokens.resolver.json` dropped from the effects | killed: `names every file extract writes beside tokens.json...` |
| `help` publish | the refusal put back under Output | killed |
| E9 | the `validate` summary changed in `help.cjs` | killed, the pinned output |
| `T8` fix | back to "cite a semantic token instead" | killed: the fix pin of `tokens-renders.test.js` |
| `cli.cjs` | a flag exported and never shown in a usage; a usage hardcoding `--forse`; a usage exported and not in `help` | killed: `shows in its usage lines the flags the engine parses, and no other` |
| pilot trace | `--include-hook-events` dropped; `--verbose` dropped | each killed: `spawns a step with a stream that carries tool calls, results and hook output` |
| pilot trace | hook messages with no output kept; tool result given as blocks dropped; `is_error` ignored | each killed: `keeps each command, tool result and hook message, in order, and the reply apart` |
| pilot trace | the `.trace.jsonl` write removed | killed: `writes the reply to the .out file and the trace beside it` |
| engine refusal for a missing `aidd_docs/ui` | says "no design system" again; drops "Run from the project root" | each killed in `bump`, `extract` and `publish` tests (3 failures) |
