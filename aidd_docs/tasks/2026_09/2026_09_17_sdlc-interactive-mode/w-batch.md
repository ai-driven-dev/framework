# W batch, on the post-review text

One sandbox per run, independent agent, output normalized as `KEY=value`.

W1 to W5 ran on the text as the inline review left it, before `03-check.md`
reordered its two recurrence rules. Only the readers in the last section, and
the two runs it names, saw that order. Nothing else in this file does.

## W1 — `interactive` as the first word (8 runs)

| Run | MODE | DECIDED_BY | FIRST_PAUSE | FRAME_BRANCH | PLANNING_READY |
| --- | ---- | ---------- | ----------- | ------------ | -------------- |
| 1-1 | interactive | text | contract | direct | yes |
| 1-2 | interactive | text | contract | direct | yes |
| 1-3 | interactive | text | contract | direct | yes |
| 1-4 | interactive | text | contract | direct | yes |
| 1-5 | interactive | text | contract | direct | yes |
| 1-6 | interactive | text | contract | direct | yes |
| 1-7 | interactive | text | contract | direct | yes |
| 1-8 | interactive | text | contract | direct | yes |

Zero dispersion. Every run that was asked for it quoted the planning-ready
sentence verbatim, so the test is read as text and not as judgement. No run wrote
anything before its pause.

## W2 — the same request without the mode word

| Run | MODE | PAUSES | FRAME_BRANCH | PR_GATE_REACHED |
| --- | ---- | ------ | ------------ | --------------- |
| 2-1 | auto | 0 | direct | stopped at the plan, which is where its prompt ended |
| 2-2 | auto | 0 | direct | yes |
| 2-3 | auto | 0 | direct | yes |
| 2-4 | auto | 0 | direct | yes |
| 2-5 | auto | 0 | direct | yes |
| 2-6 | auto | 0 | direct | yes |

Every run that went the distance reached the request gate. Three re-entered Check
once after a repair and then cleared, which is the loop converging on severity
rather than on the pass counter that was rejected.

## W3 — what counts as the mode word (one reader each)

| Run | Request opens with | MODE | Correct |
| --- | ------------------ | ---- | ------- |
| 3-1 | `auto` | auto | yes |
| 3-2 | a plain request | auto | yes |
| 3-3 | `interactive` and nothing else | NOT_RUNNABLE | yes |
| 3-4 | `build an interactive diff viewer` | auto | yes, the word is not first |
| 3-5 | `Interactive rename …` | interactive | yes, case does not matter |
| 3-6 | `interactively walk me …` | auto | yes, not a whole word |

The source handed to Frame never carried the mode word, and never lost a word
that belonged to it.

## W4 — whether a journey runs

| Run | PLAN_CALLS_FOR_A_JOURNEY | JOURNEY_RUN | POSITION | DECIDED_BY |
| --- | ------------------------ | ----------- | -------- | ---------- |
| 4-1 | yes | yes | last | text |
| 4-2 | yes | yes | last | text |
| 4-3 | yes | yes | last | text |
| 4-4 | no | no | n/a | text |

Before the fix this was the agent's judgement in every run. After it, each of
these four quoted the Deliver sentence and pointed at the plan clause that
answered it.

`2-1`, which stopped at the plan, reported the decision as judgement: the plan
writer still weighs whether the change needs a journey. That is where the design
puts it. What the fix moved is the zone's side of the question, which now reads
the plan instead of weighing the change a second time.

## W5 — the stop paths

| Run | What happened | Governed by |
| --- | ------------- | ----------- |
| 5-1 | a blocked validation stopped the run and named the missing credential | the zone that cannot proceed |
| 5-2 | same, same sentence, same resume condition | same |
| 5-3 | a contract finding reopened, a cosmetic one became a note, the recurrence stopped the run | three sentences, see below |
| 5-4 | contract finding reopens, the other two become notes | the reopening rule |
| 5-5 | same | same |

Neither blocked run committed anything, because Deliver commits after its
validations and Frame had written nothing on a planning-ready source.

## The defect this batch found

`5-3` reported that two sentences disagreed, and three independent readers
confirmed it: a non-contract finding that a pass had already acted on was a
non-blocking note under one sentence and a blocking stop under the other, and
all three answered `UNDECIDABLE`.

The reopening rule now comes first, and the recurrence rule speaks of a finding
that *would be routed a second time*, so a note never reaches it. Four readers
re-traced the same paths on the corrected text:

| Reader | A cosmetic finding recurring after the review cleared | A contract finding whose repair failed |
| ------ | ---------------------------------------------------- | -------------------------------------- |
| 8-1 | note, the request opens | stops for user authority, no request |
| 8-2 | note, the request opens | stops for user authority, no request |
| 8-3 | note, the request opens | stops for user authority, no request |
| 8-4 | — | a finding recurring before any clear also stops, loop bounded |

No reader answered `UNDECIDABLE`, and the sentence each quoted was the one the
order intends.

Readers are not execution, and this defect was execution's find, not a reader's:
seven adversarial reads had missed it. So two full runs replayed both paths
against the new order, each in its own sandbox, writing the code and its test and
committing locally.

| Run | Path | Pass 1 | Last pass | Request gate | Conflict reported |
| --- | ---- | ------ | --------- | ------------ | ----------------- |
| 5-6 | a cosmetic finding recurs after the review cleared | reopened a zone | carried as a note | reached | no |
| 5-7 | a contract finding recurs because the repair failed | reopened a zone | stopped for user authority | not reached | no |

Both quoted the sentence the order intends, and neither found a second sentence
claiming the same finding. The bound survives, and a note no longer trips it.
