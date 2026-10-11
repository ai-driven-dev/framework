# Verbatims

A verbatim is a copy of what the person said, never a rewrite.

## Allowed marks

| Need | Mark |
| --- | --- |
| Cut words inside a quote | `[...]` |
| A gap the transcriber marked | keep its own mark, such as `[inaudible]` |
| Clarify a pronoun or reference | `[bracketed words]` |
| Anonymize | the replacement label in brackets, such as `[Client A]` |
| Translation, when asked | beside the original quote, labeled, never replacing it |

Nothing else changes inside a quote: no paraphrase, no grammar fix, no merge of two turns, no filler dropped without `[...]`.

## Selection

- Quote what carries a fact, a pain, a workaround, a number, or an emotion.
- Keep one to three verbatims per question; prefer the most concrete.
- Never quote the interviewer as evidence.
- Give each verbatim an id `V<question>.<n>`, such as `V2.1`, and `V0.<n>` under `Unprompted`.

## Attribution

Transcription and dictation tools often mislabel or swap speakers.

| Situation | Label | Flag |
| --- | --- | --- |
| Speaker named and consistent with the context | name or role | none |
| Generic label such as `Speaker 1` | `speaker unclear` | candidates and the clue for each |
| Name contradicts the context or the content | the transcript label | `attribution conflict`, with the contradiction |
| Two voices merged in one turn | `speaker unclear` | `merged turn` |

Never resolve a flag by guessing; the user resolves it.

## Anonymization

| Data | Replace with |
| --- | --- |
| Person's name | a role label, numbered consistently, such as `[User A]` |
| Company or client | `[Company]` or a sector label |
| Email, phone, address, or account id | `[redacted]` |
| Any other identifier the user names | the label the user chooses |
