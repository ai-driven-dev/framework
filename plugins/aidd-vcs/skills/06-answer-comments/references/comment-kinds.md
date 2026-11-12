# Comment kinds

The kind each review comment gets, and what its thread receives.

## Kinds

| Kind | When | Reply | Thread |
| --- | --- | --- | --- |
| `done` | a change it asked for is in a commit pushed after it | what changed, and the short commit sha | resolved |
| `answer` | a question the code, docs, tests or history answer | the answer, and the file or commit it rests on | resolved |
| `user-call` | a choice only the user can settle: intent, trade-off, scope, taste | the question in one sentence and any known options, ending `Answer here.` | open |
| `user-call`, answered | the user has stated their decision, even if implementation remains | `Decision:` and the user's choice | resolved |
| `todo` | a change asked for, not pushed yet | the change, ending `To do.` | open |

## Rules

| Rule | Why |
| --- | --- |
| Between `answer` and `user-call`, pick `user-call` | a guessed answer reads as decided |
| Reply in one or two lines, in the comment's language, never quoting it back | the thread stays readable |
| Keep `Answer here.` and `To do.` verbatim, in English | a later run reads them to know which threads still wait |
| Include every supported option; when none are known, ask an open question without inventing options | avoid imposing a false choice |
| Check for a decision supplied in the conversation or thread before skipping a waiting `user-call` | a decision outside the thread also settles it |
| Skip a thread ending `Answer here.` only if no decision was supplied; skip `To do.` only if no commit was pushed since | it still waits, whatever account posted it |
