# 03 - Synthesize

Restructure one raw transcript into a synthesis organized by question asked.

## Input

The transcript, the confirmed context from frame, and the guide when one exists.

## Output

A review-ready synthesis kept in context, with its attribution flags listed.

## Process

1. **Segment.** Split the transcript into the questions actually asked, in the order asked.
   - A guide exists: map each asked question to its guide question and list the guide questions never asked.
   - A topic raised without a question goes under `Unprompted`.
2. **Attribute.** Assign each turn a speaker per [verbatims](../references/verbatims.md), flagging every uncertain one.
3. **Quote.** Select the verbatims under each question per [verbatims](../references/verbatims.md).
4. **Derive.** Derive pains, needs, and open questions per [insights](../references/insights.md).
5. **Tag.** Tag each insight with a theme per [insights](../references/insights.md), unless the user declined themes.
6. **Verify.** Search the transcript for every verbatim and fix or drop any that is not an exact match.
7. **Compose.** Fill [the synthesis template](../assets/interview-synthesis.md).
8. **Show.** Present the complete draft without persisting it.

## Test

| Case | Pass |
| --- | --- |
| Verbatim | found character for character in the transcript, bar the marks `verbatims` allows |
| Unclear speaker | quote carries a flag listed under attribution flags; no speaker guessed |
| Interviewer speech | never quoted as a verbatim |
| Insight | cites at least one verbatim id |
| Figure or name | present in the transcript or context; none invented |
| Guide present | every guide question appears, answered or listed as not asked |
| Themes declined | no theme column or tag emitted |
| Handoff | complete draft shown; workspace unchanged |
