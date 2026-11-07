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

Errors, wireframes and code are equal per project: blank and Gouvernail have no error, Kairos holds `C10` in both arms. The warnings differ by `C4` on Gouvernail and Kairos, which does not count: it is the colour debt of the code roots the model picked.

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
| level `organism` | `composition` kept in `KIND_KEYS` and `FOLDER_KINDS` | killed |
| level `organism` | `molecule` and `organism` swapped in `LEVELS` | killed |
| skills | a fifth folder under `skills/` | killed |
| one author per kind | `brand-template.md` copied into `03-foundations/assets/` | killed |
| a skill names no other | `02-brand` names `03-foundations` in an action | killed |
