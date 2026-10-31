# 06 - Change

Carry a change to a token or an element from its impact to its new versions.

## Input

The change the person wants: the tokens and elements it touches.

## Process

1. **Impact.** Run `impact` with the ids and token names, a token written as its dotted path or its CSS name, and show the report to the person: tokens, elements, screens, journeys, renders and code files, then wait for the person to agree. The report may be saved in the task folder. Its `code` list holds entry files and the code token file; the code itself follows in the feature.
   - An unknown name: the command names it and exits 2; correct the name and run it again.
   - The person refuses: stop.
2. **Apply.** Make the change in `tokens.json`, a theme file or the records.
   - For each element or screen the report lists, in the same change: raise `version` by one, add a History row with the change, `yes` in Breaking when it removes a variant, state or property, renames or deletes a token, or deprecates the element (otherwise `no`), and the task folder, then set `status: proposed`.
   - A deprecated element names `replaced-by`, or `none` with a `## Deprecation` section.
   - Leave `implemented-version` and `code` as they are: the code follows in the feature that carries the change.
   - A change of a token's value alone bumps every element reached, `no` in Breaking; the engine refuses a validated element that declares the token and was not bumped.
   - Leave `system.md`'s version alone: a publication adds its row.
3. **Regenerate.** When tokens or themes changed, run `tokens`; it exits 1 while a token has an error, so fix it first.
4. **Render.** Rewrite the markup of each reached render whose element changed, so it shows every variant and state; a render only loads `../tokens.css`, so a changed token value needs no markup change.
5. **Verify.** Run `validate` and fix what it reports.
6. **Close.** Tell the person which elements are now `proposed` at which version, that the code is untouched, and that a review is expected.

## Output

The changed files, regenerated `tokens.css`, rewritten renders, new versions with their History rows, and the closing message.

## Test

| Case | Pass |
| --- | --- |
| Token value changed | the report lists the tokens, components, screens and journeys reached, and `tokens.css` holds the new value |
| Element edited | its version rose by one, its History has the row, its status is `proposed`, and the hook reports no H8 |
| Variant removed | the History row says `yes` in Breaking |
| Unknown name | the command exits 2 and nothing is written |
| End of the run | the message says a review is expected and names no skill |
