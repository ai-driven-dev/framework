# Run: aidd-ui 4a, restructuration

Pilot lines, one per project, from `scripts/aidd-ui-pilot.cjs` (Haiku, restricted tools, the chain of the skills on throwaway copies). Errors, wireframes and code are compared; warnings follow the model's choices and do not count.

Both arms ran on fresh copies in the same session. Baseline: the skills of `origin/next` before the restructuration (the journeys skill, then the system skill receiving the brand, foundations and components parts together). After: the four skills of this branch, one request per skill, the parts unchanged. The chats of every copy were deleted by the script; none was left in `~/.claude/projects/` afterwards.

## Baseline

```txt
blank errors none warnings none wireframes all code untouched
gouvernail errors none warnings C3,R18,V6 wireframes all code untouched
kairos errors C10 warnings C3,R18,V6 wireframes all code untouched
```

## After

```txt
blank errors none warnings none wireframes all code untouched
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched
kairos errors C10 warnings C3,C4,R18,V6 wireframes all code untouched
```

## Verdict

Before the drift fix, Kairos held `C10` in both arms: see the cause under "After the drift fix". The warnings differ by `C4` on Gouvernail and Kairos, which does not count: it is the colour debt of the code roots the model picked.

## Earlier baseline runs

Two earliest baseline runs on Kairos, in the first format of the script (every id on one list, `validate` in place of `errors` and `warnings`). Neither shows `C10`, so `C10` is not constant in the baseline either.

```txt
kairos validate C3,R18,V6 wireframes all code untouched
kairos validate C3,C4,R18 (wireframes and code not recorded)
```

## Mutations

| Guard | Mutation | Result |
| --- | --- | --- |
| `changedOutsideUi` | returns `[]` | killed |
| `changedOutsideUi` | the `aidd_docs/ui/` exclusion dropped | killed |
| `copyProject` | copies the working tree, not `git archive HEAD` | killed |
| `copyProject` | writes a file into the source | killed |
| `copyProject`, git calls | the `GIT_*` variables kept in the environment | killed |
| `verdict` | keeps duplicate ids | killed |
| `verdict` | keeps ids unsorted | killed |
| `verdict` | a warning counted as an error | killed |
| `verdict` | an error counted as a warning | killed |
| `stepsWithoutWireframe` | returns `[]` | killed |
| `snapshot` | follows a link to a folder | killed |
| chat folders | the copy's last folder name alone, not its two last | killed |
| chat folders | a name containing the copy's folder names, not ending with them | killed |
| pilot arguments | `--only` ignored | killed |
| pilot arguments | the missing-checkout guard removed | killed |
| pilot arguments | the two checkouts swapped | killed |
| pilot chain | brand, foundations and components in one request | killed |
| twelve-word test | the rejected brand sentence re-added to `02-brand/actions/02-write.md` | killed |
| twelve-word test | a three-clause line of 21 words joined by `;` | passes when the test also splits on `;`, killed by the split on `.` `!` `?` alone |
| level `organism` | `composition` kept in `KIND_KEYS` and `FOLDER_KINDS` | killed |
| level `organism` | `molecule` and `organism` swapped in `LEVELS` | killed |
| owed table | the `H1` row put back in `01-journeys/references/engine.md` | killed: `01-journeys owes H1, which its own step clears` |
| owed table | the `C4` row put back in `03-foundations/references/engine.md` | killed |
| skills | a fifth folder under `skills/` | killed |
| one author per kind | `brand-template.md` copied into `03-foundations/assets/` | killed |
| a skill names no other | `02-brand` names `03-foundations` in an action | killed |
| export name kept for a shared key | never kept (`shared = false`) | killed, only the shared-key test fails |
| export name kept for a shared key | always kept (`shared = true`) | killed, 10 tests fail |
| pilot run | the `catch` rethrows | killed, only the thrown-step test fails |
| pilot arguments | `--only` naming no pilot returns the empty list | killed |
| pilot chain | every step's task folder named `system` | killed |
| `help` | one entry dropped | killed |
| `help` | `help <unknown>` exits 0 | killed |
| `help` | one sentence of 13 words | killed |
| `engine.md` | the Output block pasted back into one | killed |
| `engine.md` | `valdate` listed in one | killed |
| `stepBreaks` | returns `[]` | killed |
| `stepBreaks` | an engine file left out of the allowed set | killed |
| `stepsWithoutWireframe` | `null` back to `[]` when nothing loads | killed |
| `stepsWithoutWireframe` | `null` back to `[]` when no step exists | killed |
| owned set pinned to its line | `platforms/` dropped from the `03-foundations` line | killed |
| `reportLine` | no `no journey` wording | killed |
| pilot exit | the `broken` check dropped from the exit code | killed |
| pilot exit | the `missing === null` check dropped | survived while the chain also left an error (the error short-circuits it); killed once the test leaves no other problem |
| `BRAND_HEADINGS` | `Platforms` back | killed |
| blank pilot requests | `web and mobile` back in the brand request | killed |
| blank pilot requests | `web and mobile` gone from the foundations request | killed |
| system answers | the README line back in step 2 of `02-write.md` | killed |
| system answers | the `platforms` row of `extraction.md` removed | killed |
| actions free of commands | `node <engine> validate` put back in `02-brand/actions/03-conclude.md` | killed |
| pilot request suffix | `write no file the skill does not name` dropped from the suffix | killed |
| help | `commandList()` no longer printed for `help` alone | killed, "lists the commands" |
| help | the warning line shape dropped from `validate` | killed, "count line, error line and warning line" |
| help | the error line shape dropped from `validate` | killed |
| help | the count line dropped from `validate` | killed |
| help | the grouped line added to `validate` | killed, "no grouped line" |
| help | the grouped line dropped from `hook` | killed, "the hook alone" |
| help | the grouped line added to `impact` | killed, "the hook alone" |
| help | `bump` no longer says `--task` is never written | killed |
| pilot step files | a changed file not counted | killed |
| pilot step files | a deleted file not counted | killed |
| pilot step files | a file left as it was counted | killed |
| actions guard | `--root` put back in `02-brand/actions/03-conclude.md` | killed, the `--flag` disjunct |
| actions guard | a code fence put back in the same action | killed, the code-fence disjunct |
| publish line | removed from `03-foundations/references/engine.md` | killed |
| publish line | removed from `04-components/references/reply.md` | killed |
| `wireframes.md` | `warning R18` made `warning` | killed |
| E9 | the `validate` summary changed in `help.cjs` | killed, the pinned output |
| exit code | `validate` returns `EXIT_USAGE` (2) in place of 1 | killed |
| exit code | `tokens` blocked returns `EXIT_USAGE` (2) in place of 1 | killed |
| ignore ownership | the `ignore` of the 03 C3 row replaced by `nothing` | killed, written first and green, then mutated |
| ignore ownership | the 04 C3 row writes `ignore` in place of naming it | killed |
| warning line | the engine prints no `warning` word | killed |
| step table | `write 3` made `write 5` in `01-journeys/references/engine.md` | killed, written red first |
| step table | `write 4` made `write 2` in the same file | killed |
| help facts | `bump --created` refusals dropped | killed, written red first |
| help facts | `extract` refusals dropped | killed |
| help facts | `validate` "ungrouped" dropped | killed |
| task folder | "need not exist" dropped from `03-foundations/actions/01-prepare.md` | killed, written red first |
| elements | the path link sentence dropped | killed, written red first |
| elements | the `focus` sentence dropped | killed |
| owed table | the `T6` row put back in `03-foundations/references/engine.md`, owed by another skill | killed: `owe to another skill no problem that a step of the same skill clears` |
| owed table | the `T10` row put back in `03-foundations/references/engine.md`, owed by another skill | killed: same test |
| owed table | the `H1` row put back in `01-journeys/references/engine.md`, owed by another skill | killed: same test |
| owed table | the `C4` row put back in `03-foundations/references/engine.md`, owed by another skill | killed: same test |
| owed table | `T1` owed by another skill in `03-foundations` | killed: same test, and `say, for what its own write clears, that this skill owes it` |
| owed table | `V1` owed by another skill in `04-components` | killed: same two tests |
| owed table | the `T1` row dropped from `03-foundations` | killed: `say, for what its own write clears, that this skill owes it` |
| actions keep owed errors | `03-conclude.md` of `03-foundations` or `01-journeys` back to "a later step owes" | killed: `keep, in an action, only the errors another skill owes` |
| actions keep owed errors | `03-foundations/actions/02-write.md` step 6 back to "a later step owes" | killed: same test |
| `engine.md` repeats `help` | a verbatim `help` sentence pasted in `04-components/references/engine.md` | killed: `repeat no sentence of the engine's help` (first with a sentence cut at "With ids," it survived: the sentence compared must be whole) |
| `engine.md` repeats `help` | the `left` sentence of `help bump` pasted in `03-foundations/references/engine.md` | killed: same test |
| `SKILL.md` boundary | the "The engine writes" line back in `03-foundations` or `04-components` | killed: `state the write boundary once...` |
| `SKILL.md` boundary | "Never write in the code" back in `01-journeys`, "never in the code" back in `02-brand` | killed: same test |
| reference files | `code-errors.md` copied back into both `03-foundations` and `04-components` | killed: `hold no reference file twice, byte for byte` |
| reference files | `reply.md` of `03-foundations` copied over the one of `04-components` | killed: same test |
| `help` exits | a code declared and never returned (`2` on `validate`) | killed: `declares the exit codes each command returns, and no other` |
| `help` exits | the `1` of `validate` dropped | killed: same test |
| `help` lines | `ERROR_LINE` with the rule before the file | killed: `shows the count line, the error line and the warning line as validate prints them` |
| `help` lines | `WARNING_LINE` without the word `warning` | survived while the test only matched warnings; killed once an error line must not match the warning shape |
| `help` lines | `COUNT_LINE` plural only | killed: same test (the real line says `1 warning`, so the shape became `error(s)`, `warning(s)`) |
| `help` code rules | the "about the code" sentence dropped, or `C3` added | killed: `names, as about the code, the errors validate reports...` |
| `help` bump | the `why` sentence dropped, or its words changed | killed: `says what bump leaves as it prints it...` |
| `help` bump | "the elements reached and not raised" back | survived while the test pinned `why` alone; killed once it checks that a screen is left and the line names no element |
| `help` extract | `tokens.resolver.json` dropped from the effects | killed: `names every file extract writes beside tokens.json...` |
| `help` publish | the refusal put back under Output | killed: same test |
| `help` hook | the grouped line added to `validate` | killed: `shows the grouped line of the hook alone` |
| `help` words | a 13-word sentence | killed |
| `help` entries | an entry renamed | killed |
| `T8` fix | back to "cite a semantic token instead" | killed: the fix pin of `tokens-renders.test.js` (red first when the pin was changed) |
| `cli.cjs` | a flag exported and never shown in a usage | killed: `shows in its usage lines the flags the engine parses, and no other` |
| `cli.cjs` | a usage hardcoding `--forse` | killed: same test |
| `cli.cjs` | a usage exported and not in `help` | killed: same test |
| `ENGINE_FILES` | allowed for every step again | killed: `names a step that wrote an engine file it does not drive` |
| `ENGINE_FILES` | `history.md` for `02-brand`, `tokens.css` for `01-journeys`, `code-debt.json` for `04-components`, `tokens.resolver.json` dropped from `03-foundations` | each killed: `lets each skill's step drive only these engine files` (first run: they survived, the test derived its expectation from the table itself) |

## After the lean rewrite

Prose of the four skills cut to sentences of twelve words at most. Same pilot, fresh copies; the chats were deleted by the script.

```txt
blank errors none warnings none wireframes all code untouched
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched
kairos errors C10 warnings C3,C4,R18,V6 wireframes all code untouched
```

Wireframes and code equal the lines above.

## After the strict sentence gate

```txt
blank errors none warnings none wireframes all code untouched
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched
```

Kairos shows no `C10` here: it depended on which token file the model picked, see "After the drift fix".

## On the restored skills

```txt
blank errors none warnings V6 wireframes all code untouched
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched
```

Errors, wireframes and code hold; no `C10` this run.

## After the drift fix

Cause: `readScript` dropped each export's name, so two exports sharing a key (`action.primary` and `duelAccent.primary` in Kairos' `apps/mobile/shared/ui/tokens.ts`) wrote one token and the last one won. The stylesheet then held `#b06cf7` where the code's first export holds `#FF6B35`: 49 `C10` lines when the model picked that file, none when it picked `packages/ds/tokens/src/generated.ts`.

Fix: a key held by several exports of a script keeps its export's name (`--action-primary`, `--duel-accent-primary`).

```txt
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched
blank errors none warnings none wireframes all code untouched
```

Both Kairos runs took `apps/mobile/shared/ui/tokens.ts`, the colliding file. Verdict: no error in any of the three projects, wireframes all there, code untouched.

## On the final tree

```txt
blank errors none warnings V6 wireframes all code untouched
gouvernail errors none warnings C3,R18,V6 wireframes all code untouched
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched
```

No error on any pilot, Kairos run twice.

## After the engine help and the step ownership

Words in the skills (`cat plugins/aidd-ui/skills/*/*.md plugins/aidd-ui/skills/*/*/*.md | wc -w`): 5922 before, 4751 after.

The engine documents its commands in `help`; each `engine.md` keeps the install table, the command names and the owed table. Each pilot step must change only its own files, and at least one of them. The brand holds no `## Platforms`; the blank pilot asks for web and mobile in its foundations request.

Pilot, Haiku, fresh copies, the chats deleted by the script (none left in `~/.claude/projects/`), the copies deleted afterwards. First run, all three projects:

```txt
blank errors none warnings V6 wireframes all code untouched steps ok
gouvernail errors none warnings C3,C4,R18 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
```

Second Kairos run, `--only kairos`:

```txt
kairos errors none warnings C3,R18,V6 wireframes all code untouched steps ok
```

Both sources were only read by `git archive`. Kairos showed uncommitted changes before and after; their dates are older than the runs.

## After the intent-level actions

Actions rewritten as intentions (no command, flag or code fence); the commands moved to each `engine.md`, the reply and code-error lists to `reply.md` and `code-errors.md`. Same pilot, Haiku, fresh copies, chats deleted by the script (none left in `~/.claude/projects/`), copies removed with the cleanup line. Gouvernail and Kairos were only read by `git archive`.

First run, all three projects (skill text at 7b5753e79 as a working tree, script at c3350f731):

```txt
blank errors none warnings none wireframes all code changed 2 steps broken 2
gouvernail errors none warnings C3,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
```

The blank line broke: `02-brand` and `04-components` each wrote an unrequested `aidd_docs/tasks/<part>/decisions.md`, a log of the choices the pilot's suffix tells the model to state. Rerun of blank alone, then Kairos alone (skill text 7b5753e79, script c3350f731):

```txt
blank errors none warnings none wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
```

Cause: the pilot suffix said "say which" for each choice, and the model logged them in a file. The suffix now says to state each choice in the final reply and to write no file the skill does not name. Two blank runs after the fix (skill text 7b5753e79, script a82a3acb8):

```txt
blank errors none warnings none wireframes all code untouched steps ok
blank errors none warnings none wireframes all code untouched steps ok
```

### On the final script and skills

Working tree on top of 395c28cf2, not committed: skill text and script both. Since the last block the engine `help` regained the refusals and the ungrouped validation, the prepare actions say the task folder need not exist, `elements.md` regained two sentences, the step table of each `engine.md` is checked against its actions, and the journeys and components "created" steps say "record in the history".

A first Kairos run on the text before that last wording left `H1` on the journeys and wireframes: the model took the owed `H1` for a later step's and never recorded them.

```txt
kairos errors H1 warnings C3,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
```

Final text, gouvernail once and Kairos twice, chats and copies deleted:

```txt
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,R18,V6 wireframes all code untouched steps ok
blank errors none warnings V6 wireframes all code untouched steps ok
```

### On HEAD 492ba372f, clean tree

```txt
blank errors none warnings none wireframes all code untouched steps ok
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,R18,V6 wireframes all code untouched steps ok
```

No error on any pilot, Kairos run twice, on this exact text.

### After the review repair, working tree on top of HEAD 618b592b3, not committed

Owed table split by owner, `code-errors.md` and the repeated engine lines deleted, `help` made the single source, engine files allowed per skill. Chats deleted by the script.

```txt
blank errors T8 warnings V6 wireframes all code untouched steps ok
gouvernail errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
kairos errors none warnings C3,C4,R18,V6 wireframes all code untouched steps ok
blank errors none warnings V6 wireframes all code untouched steps ok
```

The first blank broke: the foundations step listed every token group as primitive and wrote no semantic layer, so each component cited a primitive (99 times `T8`). A rerun of blank alone on the same text left no error. The cause was in the text: nothing said semantic tokens sit in groups `primitives` omits. `tokens.md`, the system template and the `T8` fix now say it.
