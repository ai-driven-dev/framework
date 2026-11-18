# Review plan

Run `scripts/prepare-review.cjs`, beside the loaded skill, with one JSON input file outside the project.

```sh
node "$script" --input "$review_json"
```

## Input

| Field | Value |
| --- | --- |
| `account` | The current VCS account's login. |
| `threads` | Every thread, resolved ones included, as `{id, url, resolved, replyAuthors, lastReply?, lastReplyId?, newCommit?}`. |
| `classifications` | `{threadId, kind, text, source?}` per [comment-kinds.md](comment-kinds.md). |
| `decisions` | `{threadId, text, source}` for each choice the user stated. |
| `summaries` | Existing pull or merge request comments as `{id, author, body}`, full bodies. |
| `summaryChoice` | The comment ID the user chose, or `"new"` to replace a legacy summary. |
| `learnings` | `{text, url}`, each URL pointing to its thread. |

Only `account` and `threads` are required.

- `replyAuthors` lists the login of each reply's author, the thread's opening comment excluded.
- Take every login from the same API in the same form, since the planner only compares them: on GitHub, GraphQL `viewer.login` and `author.login`, never a REST bot login such as `name[bot]`.
- A resolved thread the current account never replied in is out of scope: leave it unclassified.
- `lastReplyId` is the last reply's native ID or URL, so an edited or repeated message is detected.
- `newCommit` says whether a commit was pushed since the last reply, not whether it fixes the request.
- For a legacy summary without hidden state, pass its learnings worth keeping in `learnings`.

## Output

| Field | Value |
| --- | --- |
| `threads` | `{threadId, reply?, resolve?}` operations to apply, whatever the summary's status. |
| `pending` | Open `user-call` and `todo` entries, with their links. |
| `summary` | `ready` with `operation` (`create`, `update`, `unchanged`), `targetId` and `body`; `needs-choice` with `candidates` and `allowNew`; or `unknown`. |
| `unknown` | Thread IDs with neither a classification nor a remembered kind. |

Post each `reply` and the summary `body` exactly as returned, so their hidden markers survive the next run.

Exit 0 prepared, 1 refused, 2 bad usage or unreadable input; `error` explains a non-zero exit. The planner never calls the network or writes a file, and cannot prove the snapshot is complete or a classification is right.
