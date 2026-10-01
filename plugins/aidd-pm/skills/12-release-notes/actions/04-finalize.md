# 04 - Finalize

Save the approved release notes, or keep them in the session.

## Input

The approved drafts and the user's write decision.

## Output

One saved file per approved audience, with its path and `status: approved`, or a statement that no persisted change occurred.

## Process

1. **Resolve.** Select the target of each draft per [persistence.md](../references/persistence.md).
2. **Authorize.** Confirm the user approved the write; otherwise return the drafts in the session.
3. **Write.** Save each approved draft with `status: approved`, preserving any existing file's content outside the approved change.
4. **Verify.** Read each saved file back and report its path and what changed.
5. **Continue.** Apply [handoffs.md](../references/handoffs.md) to anything left open, and remind the user that sharing is their step.

## Test

| Case | Pass |
| --- | --- |
| The write is not approved | no file under `aidd_docs/releases/` changes, and the result says so |
| An approved draft is saved | the file exists at the resolved path and reads `status: approved` |
| Notes exist for the same release and audience | the same file is updated; no second file is created |
| The run ends | nothing was sent, shared, or published |
