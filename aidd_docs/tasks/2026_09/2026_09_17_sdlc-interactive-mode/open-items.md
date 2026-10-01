# Open items

Every defect the case battery turned up that this change does not own. None was introduced by the interactive mode; each is recorded here because the mode made it visible, and several were reported independently by more than one run.

## Reported by several runs

| Item | Where | Runs |
| --- | --- | --- |
| Two owners claim the phase commit. The implement skill mandates one commit per phase as a transversal rule, while Deliver routes the commit through the commit skill. Neither says which wins, and a run that obeys both commits twice | `aidd-dev:02-implement` against `01-sdlc/references/02-deliver.md` | journey, architecture, refusals, blocked |
| What makes an end to end journey required is defined nowhere, and no zone reference points at the file that would say. One run only took the journey edge because it had read the testing memory while orienting, which the read-only-the-current-zone rule never sends it to | `01-sdlc/references/02-deliver.md` | journey, architecture, check routing |
| `planning-ready` has no test, and it is the fork that decides whether a spec is written at all, so it decides how many artifacts a person is shown | `01-sdlc/references/01-frame.md` | ticket, check routing, refusals, challenge |
| Delivery pushes before the review runs, so unreviewed work leaves the machine | `01-sdlc/references/02-deliver.md` | journey, and the challenge that reverted the relocation |

## The Check zone

| Item | Detail |
| --- | --- |
| No test separates a product finding from an implementation one | three outgoing edges partition on a word the reference never defines; one run classified a boundary defect as product, and the same defect reads as an implementation bug |
| No test separates an independent finding from a dependent one | the adjectives appear only inside the two edge labels; two findings in one function would be a coin flip |
| A finding that is neither has no edge at all | nothing covers a finding about the plan, about test quality, or about the shape of a commit |
| The Todo route and the Deliver route end at the same place | Todo's only exit is Deliver, and its one claimed difference is parallelism, which disappears wherever work cannot fan out |
| The prose admits contract findings to Frame, the diagram's edge label admits only product findings | one run followed the prose |
| `$validation_reports` is an input to the checker that no zone produces | one run substituted the raw assertion output |

## The Frame zone

| Item | Detail |
| --- | --- |
| A referenced ticket that cannot be resolved has no path | the ticket step has no failure exit, no fallback and no test row, and the degradation is recorded in no artifact |
| Frame says a backlog item is knowable only at resolution, never guessed later, while the planning step accepts a ticket id straight from the source reference | the two files disagree about the same file's contents |
| Formalizing never explores the codebase, by its own rule | so a contract can be formalized asking for what the documented architecture forbids, and the conflict cannot surface before planning |

## The Deliver zone

| Item | Detail |
| --- | --- |
| A request that conflicts with documented architecture has no handler | the conformance facet only reports, blocked means physically impossible so it cannot catch it, and the drift guard cannot either because the code matches the plan |
| A failed journey routes to the executor, which presumes the product code is at fault | nothing covers a journey whose own script is wrong |
| Neither a blocked run nor a drifting one has a destination | Deliver declares no edge for either |
| A blocked run and a drifting run are not distinguishable from the repository alone | the replan reason exists only in a report, and nothing writes it down |
| Preparing a run flips a blocked plan back to in progress | no unblock rule exists anywhere |
| Per-gate verdicts are lost | the code survives, which gate passed does not |
| The status lifecycle says workers never write the status, and the implement skill, run by the executor, writes it | the two statements cannot both hold |
| Finalizing marks a plan implemented on green validation even when half its contract is unbuilt | one run filed that against itself rather than correct it silently |

## Refusal and artifact history

| Item | Detail |
| --- | --- |
| A refusal leaves no trace | the spec is overwritten at its path, the plan passed through three revisions at one path, and the review file still reads approved after the outcome was refused |
| The status lifecycle has no refused state | and it says a review rejection does not move the status either |
| A spec is immutable once validated, with neither term defined | one run treated a refused spec as neither |
| Ambiguities are returned as notes rather than written into the spec | which is what one refusal then complained the contract was silent about |
| Repeated refusals can leave a plan incoherent | two refusals forced a split whose phases demand a test that cannot fail first, and nothing in the flow tells the person that |

## The backlog declaration

| Item | Detail |
| --- | --- |
| Whether a ticket whose identifier resolves but whose record cannot be fetched counts as already resolved | the clause that writes the declaration names a ticket already resolved, while its own test row asks only whether the request names a backlog item; one run wrote the file on the test row's weaker condition |
| The field naming the writer has two prescriptions that disagree | the prose asks for the skill's own name while the example shows it prefixed by its plugin, and the frontmatter carries the unprefixed form |
| Nothing carries the ticket across a zone boundary | Frame carries it in the resolved source, and Deliver hands the planning step only the contract; it worked in one run only because formalizing had created the folder first |
| Refining a spec declares nothing and preserves nothing | the folder is safe on that path only because refining writes no declaration either |
| Never invent collides with a request that delegates the decision | one run was told to decide what a behaviour means by a skill forbidden to guess, and nothing says which instruction wins |

## Found once the request could actually open

| Item | Detail |
| --- | --- |
| Nothing closes the plan's last status transition | the lifecycle says the review step writes `reviewed`, the review skill is read only and never writes it, so a plan stays `implemented` for good |
| The review never reaches the request | delivery commits and pushes before the review runs, the review file is written afterwards, and no step commits it, so neither the pushed branch nor the request carries it |
| The base came from the project's convention as a whole, not from resolving the branch prefix | the clause forbids assuming the production branch, and a project that declares one target for everything satisfies it without the prefix deciding anything |

## A decided consequence, not a defect

The request step is dispatched in `auto` even under `interactive`, because it produces none of the three artifacts. Its own instructions ask for the title, body and base to be approved before creation, and its test demands that approval, so that test cannot pass under `interactive`. This is the commit message case again and the answer is the same: the outcome pause sits immediately before the request, so the person has already approved what the request will carry. Reinstating a second approval on the title would put a pause where the list names none.

## Found once agents could be spawned and money could be at stake

| Item | Detail | Runs |
| --- | --- | --- |
| The check loop has no bound outside a refusal | two runs looped four times each, every repair raising the next finding; one repair introduced a defect that aborted the process on a non-finite width, and the request gate never opened. The router now pauses the outcome when a repeated zone raises a finding its predecessor already raised, which protects a person who is present and leaves the autonomous mode unbounded | independence, authority |
| The router says to parallelize while delivery says to give one executor the plan | both apply to the same work and neither yields; one run followed the more specific instruction and recorded the choice | authority |
| Parallel agents share one working tree and one test run | independent by file is not independent by validation. One executor read another's half-written test file mid-flight and reported the suite red for a file it had been told not to touch; neither agent was wrong. Nothing warns about it | authority |
| Independence is achievable for verification and not for isolation | a fresh checker can reach its verdict from the named inputs alone, but the review artifact lands in the shared task folder where the next checker finds it, and findings travel through the spec, which is a channel from one checker to the next | independence |
| The fresh checker earns its place | it found what the implementer had not claimed and had not seen: a word split that destroyed Indic and Thai text, and an orphan combining mark its own previous repair had introduced. It also caught a typo in a plan, which an author never catches in their own | independence |

## Unreachable in a sandbox

Nothing. Every one of the four items this section used to hold was unreachable because of a constraint the harness imposed, and three further sandboxes lifted all of them: one requires spawning and feeds a fresh checker only its named inputs, one carries a real remote and a forge stub that logs every call, and one declares a metered API with no key and a module three external consumers depend on. Sixty-four edges, sixty-four observed.

Two caveats on validity, both declared by the runs themselves rather than found afterwards. Several agents left their sandbox for scratch files and said so. And in the authority run this repository's own memory bank bled into the sandbox: three executors reported falling short of a mutation rule that belongs here and not there, which the first checker caught as a misattribution.
