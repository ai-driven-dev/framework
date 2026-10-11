# 02 - Prepare

Build an interview guide for one upcoming meeting.

## Input

The confirmed context from frame.

## Output

A review-ready interview guide kept in context.

## Process

1. **Goal.** State one learning goal tied to the decision the meeting feeds.
2. **Hypotheses.** List the beliefs the meeting can confirm or refute, each with the signal that would refute it.
   - The user supplied none: propose candidates from the context, ask which to keep, and wait.
3. **Questions.** Write and order the questions per [questions](../references/questions.md), each hypothesis covered by at least one.
4. **Observe.** List the signals to watch beyond the answers per [questions](../references/questions.md).
5. **Compose.** Fill [the guide template](../assets/interview-guide.md).
6. **Show.** Present the complete draft without persisting it.

## Test

| Case | Pass |
| --- | --- |
| Hypothesis | each has a refuting signal and at least one question that can produce it |
| Question | passes every check in `questions`; none names the product or a solution |
| Order | sections follow the sequence in `questions` |
| Context | goal, participants, and decision trace to frame; none invented |
| Cleanup | no placeholder or template instruction remains |
| Handoff | complete draft shown; workspace unchanged |
