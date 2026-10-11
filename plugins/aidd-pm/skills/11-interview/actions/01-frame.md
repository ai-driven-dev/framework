# 01 - Frame

Resolve which moment the user is in and the context the interview serves.

## Input

An upcoming meeting, a transcript as pasted text or a file, an existing guide, or the current context.

## Output

The route, `prepare` or `synthesize`, and a confirmed context: participants and their roles, interview goal, the decision it feeds, and any existing guide.

## Process

1. **Route.** Take `prepare` for a meeting still to come and `synthesize` for a supplied transcript; otherwise ask which and wait.
   - Neither an interview nor a client meeting: apply [handoffs](../references/handoffs.md) and stop.
2. **Read.** Read the supplied transcript, guide, and any project artifact the user names before asking anything they already answer.
3. **Collect.** Ask for the missing context field that most changes the output and wait.
   - `prepare` needs who is met and their role, why the meeting happens, and the decision it feeds.
   - `synthesize` needs who spoke and their role, and the interview goal; the decision it feeds is optional.
   - Loop on `Collect` while a needed field is missing.
4. **Confirm.** Restate the context in one short block and wait for correction.

## Test

| Case | Pass |
| --- | --- |
| No route inferable | workspace unchanged; exactly one question on before or after the meeting |
| Prepare without a decision | no guide drafted; one question on the decision the meeting feeds |
| Field absent from every input | asked or marked unknown, never filled with an assumed value |
| Transcript supplied | no question asked that the transcript already answers |
| Not an interview | no guide or synthesis; the offered capability returned |
