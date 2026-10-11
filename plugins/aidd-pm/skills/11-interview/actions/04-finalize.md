# 04 - Finalize

Let the user revise, anonymize, keep, or persist the guide or synthesis.

## Input

The draft, its sources, and the user's feedback.

## Output

The authorized guide or synthesis, in session or at its resolved path. After writing, report the path and the verification result. Without a write, state that no persisted change occurred.

## Process

1. **Review.** Invite corrections and wait.
   - A content correction: return to `prepare` or `synthesize`.
2. **Anonymize.** When the user asked for it, apply the anonymization in [verbatims](../references/verbatims.md).
3. **Authorize.** Ask whether to keep the draft in session or persist it, and wait.
4. **Place.** Apply [persistence](../references/persistence.md) to resolve the file.
5. **Write.** Persist only the authorized file; preserve user edits in an existing one.
6. **Verify.** Read the written file back and check every verbatim still matches the transcript, bar anonymization marks.
7. **Continue.** Apply [handoffs](../references/handoffs.md) to the next move.

## Test

| Case | Pass |
| --- | --- |
| Unauthorized draft | workspace unchanged; response ends with one session-or-persist question |
| Anonymized | no personal identifier from the transcript remains; each one replaced by the same label everywhere |
| Persisted | one file at the standard path; its read-back matches the approved draft |
| Existing file | edits outside the authorized change preserved |
| Handoff | capability offered with what was observed, never invoked |
| No write | response states that no persisted change occurred |
