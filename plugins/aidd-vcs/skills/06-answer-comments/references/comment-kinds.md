# Comment kinds

The judgments and reply drafts the model supplies to the planner.

## Kinds

| Kind | When | Draft |
| --- | --- | --- |
| `done` | the requested change is in a commit pushed after the comment | what changed, with the short commit sha as its source |
| `answer` | code, docs, tests or history answer the question | the answer, with its file or commit as its source, kept out of the answer's text |
| `user-call` | only the user can settle the intent, trade-off, scope or taste | the question |
| `todo` | the requested change is not pushed yet | the change |

## Rules

| Rule | Why |
| --- | --- |
| Between `answer` and `user-call`, pick `user-call` | a guessed answer reads as decided |
| Reply in one or two lines, in the comment's language, never quoting it back | the thread stays readable |
| Include every supported option; when none are known, ask an open question without inventing options | avoid imposing a false choice |
