# Comment kinds

The kind each review comment gets, and what its thread receives.

## Kinds

| Kind | When | Reply | Thread |
| --- | --- | --- | --- |
| `done` | a change it asked for is in a commit pushed after it | what changed, and the short commit sha | resolved |
| `answer` | a question the code, docs, tests or history answer | the answer, and the file or commit it rests on | resolved |
| `user-call` | a choice only the user can settle: intent, trade-off, scope, taste | the question in one sentence and its options, ending `Answer here.` | open |
| `user-call`, answered | the user replied in a `user-call` thread | `Decision:` and the user's choice | resolved |
| `todo` | a change asked for, not pushed yet | the change, ending `To do.` | open |

## Rules

| Rule | Why |
| --- | --- |
| Between `answer` and `user-call`, pick `user-call` | a guessed answer reads as decided |
| Reply in one or two lines, in the comment's language, never quoting it back | the thread stays readable |
| Keep `Answer here.` and `To do.` verbatim, in English | a later run reads them to know which threads still wait |
| Skip a thread ending `Answer here.`, or `To do.` with no commit pushed since | it still waits, whatever account posted it |
