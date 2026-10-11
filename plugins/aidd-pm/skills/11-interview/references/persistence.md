# Persistence

Write one folder per meeting, `aidd_docs/product/interviews/<yyyy-mm-dd>-<slug>/`, dated by the meeting. The slug names the topic or the role met, never a person when anonymized.

| Artifact | File |
| --- | --- |
| Interview guide | `guide.md` |
| Synthesis | `synthesis.md` |
| Raw transcript | `transcript.md`, only when the user asks |

| Situation | Result |
| --- | --- |
| explicit target given by the user | use it |
| no file for this meeting | create one |
| file exists for this meeting | update it; preserve edits outside the change |
| several candidate meetings | ask the user |

Markdown is the only support this skill writes. Pasting into a wiki or ticketing tool is the user's move.
