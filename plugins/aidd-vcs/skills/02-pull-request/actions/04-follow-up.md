# 04 - Follow up

Own the asynchronous result of the request within the user's authorization.

## Input

The request URL, current head SHA, repository delivery contract, authorized
actions, and any existing follow-up record.

## Output

One explicit state: `watching`, `handed-to-parent`, `complete`, or `blocked`,
with the owner, SHA, correction count, pending feedback and evidence. `watching`
ends a turn, not the delivery task. Creation success alone is not review success.

## Process

1. **Owner.** The top-level session owns follow-up. On T3 a delegated child
   never watches: return the URL, head SHA, check/review state, consumed correction
   passes and unresolved feedback to the parent. Its last line is
   `PR <full URL>, head <SHA>, checks and reviews <state>`.
   The parent must acknowledge ownership and execute this action itself; a
   child's successful return is not an acknowledgement or a subscription.
2. **Recover.** Keep a durable per-request record outside the candidate's tracked
   files, using the host's durable task state or a file under
   `git rev-parse --git-common-dir`. Record canonical host/repository/number,
   owner thread, head, expected checks/reviewers, authorization, consumed passes,
   in-flight batch, processed source IDs/versions, watch acknowledgement and stop
   reason. Persist intent before mutations, then their observed result. Never
   reset the count on a wake, push, compaction or session interruption. With a
   missing record, reconstruct from GitHub and session traces; uncertainty about
   spent passes or competing owners blocks further mutations.
3. **Reconcile.** Read the current head and fully paginated checks, reviews,
   comments and discussions before waiting and on every wake. Apply the local
   review-handling contract when provided; otherwise assess feedback and route
   repairs to the responsible implementation capability. Finish authorized
   branch updates, validation and pushes before waiting. Re-read the head before
   mutating; evidence for an older head cannot close the current one. An old
   inline comment still needs assessment against current code. An API failure
   or incomplete page is not an empty backlog. Deduplicate by source identity
   and version (ID plus update time/content), not by wake count; verify whether
   an interrupted push or reply already succeeded before retrying it.
4. **Bound.** Use the repository's correction budget; otherwise allow at most
   two automatic batches. Reserve a batch before its first corrective mutation
   (code, evidence, response or rerun), recording its source IDs and starting SHA.
   Finish/recover that batch before admitting another. Read-only reconciliation,
   waiting and duplicate events consume none. Multiple commits for one batch
   consume one. Never retry infrastructure or external writes indefinitely.
   Missing authorization, exhausted budget, unresolved disagreement or an
   intentional draft awaiting the user leads to a documented handback.
5. **Wait on T3.** Discover `watch_pull_request` from the live tools. Handle
   existing feedback first: only later comments wake the watcher. Once local
   work is done and external results remain, persist the intended wait, call
   `watch_pull_request` and end the turn immediately. Its successful tool result
   is the subscription evidence. Do not claim a watch on tool failure. The watch
   survives wakes and pushes: on a normal wake reconcile without re-registering.
   If an earlier handback unwatched the request, a newly authorized wait needs
   a new registration. On an interrupted registration, reconcile the transcript
   with the saved intent; an unknown outcome is not a confirmed subscription.
   Use no polling loop, sleep, `gh --watch`, Monitor or scheduled PR check.
6. **Close deliberately.** Check the latest SHA against every expected reviewer
   and required check, including optional checks that the delivery contract
   requires. An analysis/publish job succeeding is not the review verdict. Do
   not stop at green CI while a late reviewer is still expected. On success,
   closure, exhausted budget or human decision, call `unwatch_pull_request`
   before handing back on T3; report failures to stop the watch. Never merge,
   waive findings, accept risk or incur new costs without authorization.

T3 documents wakes for failed checks, passed required checks, comments/reviews
and conflicts. It does not promise a wake for every optional successful check,
a registration cursor, a timeout, or replay after an offline interval. Record
these as unverified until exercised. A host without a persistent watcher, or a
required signal with no supported wake, is `blocked`, not silently monitored;
do not invent a polling fallback. A local recovery record alone cannot wake an
agent after session loss. Name the missing host capability and pending result.

## Test

Exercise on a disposable request, preserving the tool and event trace:

- Direct creation and delegated creation both reach a parent-owned watch.
- A late reviewer after green CI is handled without a user message.
- Red CI, a corrective push and a stale result reconcile against the new head.
- Repeated events and a restart after an acknowledged write do not repeat it
  or spend another pass. An edited comment is new input.
- After the second batch, reconcile its results, then hand back unresolved
  findings with an acknowledged unwatch; do not start a third batch.
- Optional success without a wake, offline delivery, and feedback arriving
  between reconciliation and registration are probed, not assumed covered.
- Record GitHub occurrence, T3 receipt (or explicitly labelled proxy), agent
  handling start and finish separately. A static skill check proves none of
  these runtime properties.
