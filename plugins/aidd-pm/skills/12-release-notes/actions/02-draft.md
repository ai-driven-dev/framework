# 02 - Draft

Write the release notes for each requested audience from the fact sheet.

## Input

The fact sheet from collect, the requested audiences, and any review findings to fold.

## Output

One release notes draft per audience, per [release-notes-template.md](../assets/release-notes-template.md).

## Process

1. **Audience.** Take the audiences the user named; otherwise ask whether the notes are internal, customer-facing, or both.
2. **Fill.** Fill [release-notes-template.md](../assets/release-notes-template.md) for the internal audience from the fact sheet rows.
   - `What you can do now` restates each shipped row's user outcome in plain words.
   - `Impacted areas` summarizes each functional area, never a file list.
   - `Known limitations` takes the fact sheet's limitations and every partially shipped row.
3. **Demo.** Write the demo steps from the acceptance criteria of shipped rows only.
   - No shipped row carries acceptance criteria: write one TBD marker instead of steps.
4. **Derive.** Derive each other audience from the internal draft per [audiences.md](../references/audiences.md), line by line.
5. **Gaps.** Collect every TBD marker per [tbd-marker.md](../references/tbd-marker.md) into `Open questions`.
6. **Show.** Present every draft, then hand them to review.

## Test

| Case | Pass |
| --- | --- |
| An internal draft is read back | every item in `Scope`, `What you can do now`, and `Impacted areas` names a ref present in the fact sheet |
| A customer draft is read back | each line maps to an internal line, and no ticket id, pull request, or file path appears |
| A number, date, or name appears in a draft | the same value appears in the fact sheet |
| A row is `not in this release` | it is absent from `What you can do now` in every draft |
| The draft is shown | every section the audience keeps is present, and no other |
