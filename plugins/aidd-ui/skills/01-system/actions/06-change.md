# 06 - Change

Carry a change to a token or an element from its impact to its new versions.

## Input

The change the person wants: the tokens and elements it touches.

## Process

1. **Impact.** Run `impact` with the ids and token names, a token written as its dotted path or its CSS name, and show the report to the person: tokens, elements, screens, journeys, renders and code files, then wait for the person to agree. The report may be saved in the task folder. Its `code` list holds entry files and the code token file; the code itself follows in the feature.
   - An unknown name: the command names it and exits 2; correct the name and run it again.
   - The person refuses: stop.
2. **Apply.** Make the change in `tokens.json`, a theme or breakpoint file or the records.
   - For each element or screen the report lists, deprecated ones aside, in the same change: raise `version` by one, add a History row with the change, `yes` in Breaking when it removes a variant, state or property, renames or deletes a token, or deprecates the element (otherwise `no`), and the task folder, then set `status: proposed`.
   - A deprecated element in the report is named to the person and left untouched: it keeps its version and status.
   - An element this change deprecates names `replaced-by`, or `none` with a `## Deprecation` section.
   - For each reached screen a review under `aidd_docs/ui/reviews/` names in `screens`, add to that review's `## Verdicts` one `pending` row per state at its new version; the older rows stay. The report leaves reviews out, so read them.
   - Leave `implemented-version` and `code` as they are: the code follows in the feature that carries the change.
   - A change of a token's value alone bumps every element reached but a deprecated one, `no` in Breaking; the engine refuses a validated element that uses the token, directly or through an element it uses, and was not bumped.
   - Leave `system.md`'s version alone: a publication adds its row.
3. **Regenerate.** When tokens, themes or breakpoints changed, run `tokens`; it exits 1 while a token has an error, so fix it first.
4. **Render.** Rewrite the markup of each reached render whose element changed, so it shows every variant and state; a render only loads `../tokens.css`, so a changed token value needs no markup change.
5. **Verify.** Run `validate` and fix what it reports.
6. **Close.** Tell the person which elements are now `proposed` at which version, which deprecated ones stayed as they are, that the code is untouched, and that a review is expected.

## Output

The changed files, regenerated `tokens.css`, rewritten renders, new versions with their History rows, `pending` verdict rows for the screens under review, and the closing message.

## Test

| Case | Pass |
| --- | --- |
| Token value changed | the report lists the tokens, components, screens and journeys reached, and `tokens.css` holds the new value |
| Element edited | its version rose by one, its History has the row, its status is `proposed`, and the hook reports no H8 |
| Variant removed | the History row says `yes` in Breaking |
| A deprecated element reached | it is named, its version and status unchanged, and the hook reports no H8 |
| A reached screen a review names | the review holds one `pending` row per state at the new version, and the hook reports no R13 |
| Unknown name | the command exits 2 and nothing is written |
| End of the run | the message says a review is expected and names no skill |
