# Findings

What eight sandbox runs and six adversarial readings turned up, and what was done about each.

## The push was reverted

`02-deliver.md`, `aidd-vcs:02-pull-request` and its `03-create` action are back to their original text. The change had been agreed, then challenged, and the challenge held on four counts.

| Count | Why it held |
| --- | --- |
| The benefit was near zero | it stopped a rejected candidate reaching the remote, on a feature branch nobody reads before the request exists |
| It duplicated a concern | pushing to an existing remote lived only in the commit skill; `00-repo-init` pushes while creating a remote, a different act |
| The file contradicted itself | the frontmatter still read `Not for committing, pushing, or merging a branch` beside a rule that pushed |
| The original already met the stated rule | it said `Commit and push the validated work`, and validation at that point is assert plus the journey |

What survived from that phase is the real bug it uncovered: `ship-a-feature.md` committed and then asked for a request on a branch nothing had pushed. One option on one step fixes it, with no skill touched.

## Fixed in the mode itself

Every entry below is a defect in the orchestrator's own paragraph. The right-hand column says what caught it, because the split matters: reading the file found wording faults, and only running it found the faults that live between this file and the providers it dispatches.

| Defect | Caught by |
| --- | --- |
| Mode propagation put a pause on the commit message, an artifact on no list | a run reaching the commit provider |
| The stand-in clause asserted a dispatched step supplies its own pause; the challenge provider has none | a run reaching the outcome |
| Clarifying the source ran in `auto` and answered its own questions, persisting nothing | a run on a deliberately vague source |
| The spec was counted as a fourth artifact, reversing Frame's own `Spec → Contract` order | the same run, plus two mode-selection runs |
| The paragraph forbade unnamed pauses while mandating a step whose defined behavior is to stop and ask | a run re-entering Frame after a refused spec |
| `the contract once it is framed` did not cover a source used directly, where nothing frames anything | a run on a planning-ready source |
| A refused outcome was routed by delegating to a three-way split with no rule for a lone finding | a run exercising a refusal |
| `four times` counted occurrences, which contradicted re-pausing after a refusal | a reading |
| A delegated pause on an unlisted artifact had no resolution | a reading |
| `auto` was offered by the argument hint and handled nowhere in the body | a reading |
| Mode selection matched the word anywhere in the request, so prose could flip it | a reading |
| Nothing bounded a repeated refusal | a reading |

## What the runs established

| Run | Result |
| --- | --- |
| no mode word | zero pauses to the request threshold, work committed locally |
| `interactive` on a planning-ready source | pauses on the contract, then the plan, then the outcome before the request |
| the plan pause | came from the planning provider itself, not from the orchestrator |
| a refused outcome | routed to Deliver, the zone replayed, the plan pause fired again |
| a refused spec | routed to Frame, unambiguous, and clarification re-ran in `interactive` |
| `make the helper interactive so callers can…` | `auto`, the word inside the source selects nothing |
| `auto add a truncate function…` | `auto`, the explicit word names the default |
| `interactive` on a vague source | Frame took its clarify then formalize branch and wrote a spec |

## Open, and deliberately not fixed here

| Item | Why it is left |
| --- | --- |
| `beside` has no delimiter, so a request whose first word is literally `interactive` is undecidable | every run landed on the right side; the case is untested, not broken |
| A refusal leaves no trace, and a re-entered zone writes over the refused artifact | recording it means a new artifact, and the folder reuse belongs to the spec skill |
| A repeated Deliver re-enters at its head, so a one-line repair re-plans | Deliver's existing shape; the refusal path only feeds it more often |
| `actionable` is undefined, and turned out to be settled by the user rather than by the checker | the same finding cleared the gate and then reopened the zone |
| `planning-ready` is undefined, and it decides whether a spec is written at all | belongs to `01-frame.md`, untouched by this change |
| A refusal cannot reach the spec skill's own refine action; no edge in Frame reaches it | routing to Frame re-enters at the source by design |
| `taking an irreversible action` is undefined, so the number of stops in `auto` is not decidable | the sentence predates the two modes |

## Not verified

Every dispatch in every run resolved to the installed build under `~/.config/aidd/cache/built/5.3.0/`, never to this worktree. The runs therefore prove the orchestrator's own paragraph, which they read from the worktree, against providers that are a published snapshot.
