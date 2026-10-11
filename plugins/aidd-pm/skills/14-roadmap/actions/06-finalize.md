# 06 - Finalize

Approve the roadmap and persist both views, or keep them in the session.

## Input

The two drafts, and the authority for a write.

## Output

Both views in the session or at their resolved paths. After a write, report each path, changed fields as `before -> after`, and the verification result. Without a write, state that no persisted change occurred.

## Process

1. **Authorize.** Use caller-provided bounded authority, or ask whether to keep the drafts in the session or persist them, and wait.
2. **Place.** Resolve both paths per [persistence](../references/persistence.md).
3. **Log.** On an update, add one entry per changed item to the team view's change log, with the reason the user gave.
4. **Write.** Write both views; preserve user edits outside the authorized change.
5. **Verify.** Read both files back and report what changed.
6. **Continue.** Apply [handoffs](../references/handoffs.md) to any open gap.

## Test

| Case | Pass |
| --- | --- |
| Unauthorized | workspace unchanged; response ends with one session-or-persist question |
| First write | both files exist at the paths `persistence` gives; the team file reads `status: approved` |
| An update | each changed item has one change-log entry with `before -> after` and a reason |
| User edits outside the change | preserved byte for byte |
| No write | the response states that no persisted change occurred |
