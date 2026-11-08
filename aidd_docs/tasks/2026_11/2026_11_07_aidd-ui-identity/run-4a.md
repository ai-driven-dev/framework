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
