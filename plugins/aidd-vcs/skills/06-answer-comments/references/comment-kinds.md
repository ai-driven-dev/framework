# Comment kinds

The judgments and reply drafts the model supplies to the planner.

## Kinds

| Kind | When | Text | Source |
| --- | --- | --- | --- |
| `done` | the requested change is in a commit pushed after the comment | what changed | the pushed commit's SHA |
| `answer` | code, docs, tests or history answer the question | the answer | its file, commit or other evidence |
| `user-call` | only the user can settle the intent, trade-off, scope or taste | the question, addressed to the user | none |
| `todo` | the requested change is not pushed yet | the change to make | none |

A decision the user supplied is not a kind: its text acknowledges the choice, with a decision label, and its source is the user's message.

## Rules

| Rule | Why |
| --- | --- |
| Between `answer` and `user-call`, pick `user-call` | a guessed answer reads as decided |
| Write each text in the language the project's instructions set, else the comment's, in one or two lines, never quoting the comment back | the thread stays readable |
| End no text with its source | the planner appends it |
| Include every supported option; when none are known, ask an open question without inventing options | avoid imposing a false choice |
