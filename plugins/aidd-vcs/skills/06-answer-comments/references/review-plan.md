# Review plan

Run `scripts/prepare-review.cjs`, beside the loaded skill, with one JSON input file outside the project.

```sh
node "$script" --input "$review_json"
```

## Input

| Field | Value |
| --- | --- |
| `account` | Current VCS account's login, matching `replyAuthors` and summary authors. |
| `threads` | Complete snapshot, including resolved threads, as `{id, url, resolved, replyAuthors, lastReply?, lastReplyId?, newCommit?}`, where `replyAuthors` lists the login of each reply's author, excluding the thread's opening comment. |
| `classifications` | Proposed `{threadId, kind, text, source?}` entries, with `kind` from `comment-kinds.md`. |
| `decisions` | Explicit user choices as `{threadId, text, source}`, where `source` identifies the user's message. |
| `summaries` | Existing comments as `{id, author, body}`, including the full bodies. |
| `summaryChoice` | The comment ID the user chose or agreed to adopt, or `"new"` when they chose a new legacy replacement. |
| `learnings` | Proposed `{text, url}` items, with each URL pointing to its review thread. |

All fields except `account` and `threads` are optional arrays or choices. `classifications`, `decisions`, `summaries` and `learnings` default to empty arrays.

`text` is the reply, question, change or decision without a status suffix, in at most two lines; a `done` or `answer` text never ends with its source, which the script appends. A `done` source is the pushed commit's SHA; an `answer` source is its file, commit or other evidence. `newCommit` says whether a commit was pushed since the thread's last reply, not whether it fixes the request. The model supplies the classification and verifies the meaning of its evidence.

Supply the last reply's native ID or URL as `lastReplyId` when available; change detection fingerprints both the ID and text, detecting edits and repeated text under a new ID without storing the message. In an open thread, remembered classifications survive the same message or their expected reply; new content needs a fresh classification or remains unknown. Closed threads retain their known historical classification unless the current input replaces it.

Take `account`, `replyAuthors` and summary authors from the same API in the same form, since the script only compares them: on GitHub, GraphQL `viewer.login` and `author.login`, never mixing REST bot logins such as `name[bot]`. A resolved thread the current account never replied in is out of scope: leave it unclassified; it is neither counted nor reported unknown.

## Output

| Field | Value |
| --- | --- |
| `threads` | Allowed `{threadId, reply?, resolve?}` operations, independent of summary readiness. |
| `pending` | Remaining open `user-call` and `todo` entries, including skipped waiting threads, with their IDs and links. |
| `summary` | A `status` of `ready`, `needs-choice` or `unknown`. |
| `unknown` | Snapshot thread IDs without a current or persisted classification. |

A ready summary supplies `operation` (`create`, `update`, `unchanged`), `targetId` for an existing target, and `body`. Pass `body` directly from parsed JSON or an input file to the connector without retyping it, so its hidden state survives the next run. A choice supplies candidate IDs and `allowNew`; ask the user and rerun with `summaryChoice`. Unknown history supplies no publishable body; recover classifications from evidence before rerunning, without treating resolution or old prose totals as a kind.

For an untyped legacy summary, include its learnings worth retaining in `learnings`; prose totals are never imported.

The script owns waiting detection, reply suffixes, decision acknowledgements, resolution eligibility, summary targeting, counts and rendering. It remembers decisions and learnings in the summary, excludes resolved threads from operations and pending questions, and preserves settled historical counts by thread ID. On a partial previous run it emits only a missing resolution when the expected reply is already present.

The JSON result's `error` explains a refusal at exit 1 or bad usage/input reading at exit 2. Exit 0 means preparation completed, even when a summary needs a choice or has unknown history. No network call or file write occurs. The connector still collects the snapshot and applies allowed operations; the script cannot prove that collection is exhaustive or that the model interpreted a decision or evidence correctly.
