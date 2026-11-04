# 03 - Conclude

Leave a design system that validates, and tell the user what follows.

## Input

`<engine>`, the files written, and `bump`'s JSON for a change.

## Process

1. Run `node <engine> validate` and fix each line that has no `warning`; repeat until none is left.
2. Reply to the user with:
   - the elements created or raised, with their versions; for a change, also those `bump` left, from its `left` list;
   - the warnings left, from `validate`: colour literals in the code, code files no record links yet, lengths no token holds;
   - that the code is untouched and a review is expected.

## Output

The reply to the user.
