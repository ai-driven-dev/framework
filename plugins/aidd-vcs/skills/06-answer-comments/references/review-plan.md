# Review plan

Run `scripts/prepare-review.cjs` to turn the snapshot and the classifications into the operations to apply.

```sh
node "$planner" --input "$review_json"
```

- `$planner`: the absolute path of `scripts/prepare-review.cjs`, next to the loaded `SKILL.md`.
- `$review_json`: a temporary file outside the project holding the fields below, only `account` and `threads` required.

| Field | Value |
| --- | --- |
| `account` | The current account's login. |
| `threads` | Every thread, resolved ones included: `{id, url, resolved, replyAuthors, lastReply?, lastReplyId?, newCommit?}`. |
| `classifications` | `{threadId, kind, text, source?}` per `comment-kinds.md`. |
| `decisions` | `{threadId, text, source}` per choice the user stated. |
| `summaries` | The request's comments as `{id, author, body}`, full bodies. |
| `summaryChoice` | The comment ID the user chose, or `"new"`. |
| `learnings` | `{text, url}`, the URL pointing to its thread; for a legacy summary, its learnings worth keeping. |
| `labels` | The summary's words in the replies' language: any of `title`, `done`, `answered`, `decided`, `userCall`, `todo`, `learnings`, `thread`. |

- `replyAuthors`: each reply's author, the opening comment excluded.
- Logins: all from one API in one form; on GitHub, GraphQL `viewer.login` and `author.login`.
- `lastReplyId`: the last reply's native ID, so an edited or repeated message is detected.
- `newCommit`: a commit was pushed since the last reply, whether or not it fixes the request.
- A resolved thread the account never replied in stays unclassified.

| Output | Value |
| --- | --- |
| `threads` | `{threadId, reply?, resolve?}` to apply. |
| `pending` | Open `user-call` and `todo` entries with their links. |
| `summary` | `ready` with `operation`, `targetId`, `body`; `needs-choice` with `candidates` and `allowNew`; or `unknown`. |
| `unknown` | Threads with neither a classification nor a remembered kind. |

Post each `reply` and `body` exactly as returned, so their hidden markers survive the next run.

| Exit | Meaning |
| --- | --- |
| 0 | Prepared |
| 1 | Refused, `error` explains |
| 2 | Bad usage or unreadable input |
