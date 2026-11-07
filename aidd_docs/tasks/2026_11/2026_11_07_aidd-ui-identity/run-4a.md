# Run: aidd-ui 4a, restructuration

Pilot lines, one per project, from `scripts/aidd-ui-pilot.cjs` (Haiku, the chain of the skills on throwaway copies).

## Baseline

The chain of the skills before the restructuration: the journeys skill, then the system skill receiving the brand, foundations and components parts together.

```txt
blank validate VALID wireframes all code untouched
gouvernail validate C3,R18,V6 wireframes all code untouched
kairos validate C3,R18,V6 wireframes all code untouched
```

## After

The chain of the four skills, one request per skill, the parts unchanged.

```txt
blank validate VALID wireframes all code untouched
gouvernail validate C3,R18,V6 wireframes all code untouched
kairos validate C3,C4,R18,V6 wireframes all code untouched
```

Blank and Gouvernail equal their baseline. Kairos differs by two warning ids, C4 and V6, and the cause is the run, not the restructuration: two more runs of each chain on Kairos gave `C3,C4,R18` (baseline) and `C3,C4,R18,V6` (after), so the baseline differs from itself too. What varies is the code roots and platforms the model picks: the first baseline kept one mobile code root and recorded no colour debt, the first after run took web and mobile roots whose literals are C4 warnings. Limit: on a real project, compare the errors, the wireframes and the code; the warning ids vary between two runs of one tree. No run left an error in the after chain, and none touched the code.

## Mutations

| Guard | Mutation | Result |
| --- | --- | --- |
| `changedOutsideUi` | returns `[]` | killed |
| `changedOutsideUi` | the `aidd_docs/ui/` exclusion dropped | killed |
| `copyProject` | copies the working tree, not `git archive HEAD` | killed |
| `copyProject` | writes a file into the source | killed |
| `verdict` | keeps duplicate ids | killed |
| `verdict` | keeps ids unsorted | killed |
| `stepsWithoutWireframe` | returns `[]` | killed |
| `snapshot` | follows a link to a folder | killed |
| chat folders | one copy's folder name alone, not its two last | killed |
| pilot chain | brand, foundations and components in one request | killed |
| level `organism` | `composition` kept in `KIND_KEYS` and `FOLDER_KINDS` | killed |
| level `organism` | `molecule` and `organism` swapped in `LEVELS` | killed |
| skills | a fifth folder under `skills/` | killed |
| one author per kind | `brand-template.md` copied into `03-foundations/assets/` | killed |
| a skill names no other | `02-brand` names `03-foundations` in an action | killed |
| chat folders | a name containing the copy's folder names, not ending with them | killed |
