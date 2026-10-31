# 02 - Brand

Write the brand and the root of the design system.

## Input

The state from survey.

## Process

1. **Gather.** Collect what the brand rests on: project, users, domain, platforms, personality and tone, references and anti-references, plus an imposed charter and a glossary when the person has them.
   - Existing code: read the README, the package manifest and the visible copy first, and propose answers to confirm.
   - Ask only what these leave open.
2. **Declare.** Decide the root's values: platforms, breakpoints, themes with the base first, locales, writing directions, the token groups that are primitives, the code roots, the file where the code consumes the tokens, the paths to ignore and the component libraries in use.
   - Existing code: take the code roots, the token file and the libraries from what survey found.
3. **Write.** Create `aidd_docs/ui/brand.md` from the [brand template](../assets/brand.md) and `aidd_docs/ui/system.md` from the [system template](../assets/system.md).
4. **Route.** Read the next action for the state.
   - Blank: read [tokens](04-tokens.md).
   - Existing code: read [extract](03-extract.md).

## Output

`brand.md` and `system.md`, both `proposed`.

## Test

| Case | Pass |
| --- | --- |
| Blank project | both files exist and the hook reports only what a later step still owes |
| Existing code | `code-roots` names the folders survey found |
| Unknown task folder | the person is asked for it before the History row is written |
