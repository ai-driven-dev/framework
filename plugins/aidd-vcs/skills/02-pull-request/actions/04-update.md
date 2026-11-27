# 04 - Update

Update an existing request within the requested scope.

## Input

The request and the requested edit or change in scope.

## Output

The updated request, its title, link, and main changes.

## Process

1. **Read.** Read the request's title and body. For a change in scope, read its full diff against its actual base.
2. **Write.** Make only the requested edit, or update the title and body for the changed scope. Apply the writing guidance in [02-draft](02-draft.md); preserve author-owned checkboxes and relevant context.
3. **Update.** Save the changes and return a table with the title, link, and main-change bullets.

## Test

- A targeted edit leaves unrelated content unchanged.
- A scope update reflects the full diff and preserves author-owned checkboxes.
- The returned table uses the request's main-change bullets.
