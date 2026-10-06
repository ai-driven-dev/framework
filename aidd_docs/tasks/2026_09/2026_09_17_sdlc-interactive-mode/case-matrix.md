# Case matrix

Every decision edge the orchestration declares, and the run that exercised it. Derived by reading the router and its three zone references end to end, not by recalling what was tested.

The runs named here are this campaign's. The later batch, on the text as it stands, is in `w-batch.md`.

Legend: `done` an observed run covered it · `flight` a run is covering it · `gap` nothing covers it yet · `n/a` unreachable in a sandbox.

## Router, mode selection

| # | Edge | State |
| --- | --- | --- |
| R1 | no mode word, so `auto` | done |
| R2 | `auto` beside the source names the default | done |
| R3 | `interactive` beside the source | done |
| R4 | the word inside the source's own text selects nothing | done |
| R4b | first word is literally the mode word, nothing beside it | done |
| R4c | both words passed, case variants, a leading dash, trailing position | done |

## Router, autonomous behaviour

| # | Edge | State |
| --- | --- | --- |
| R5 | `auto` stops only for money, an irreversible action, or user authority | done |
| R6 | a delegated step decides without asking | done |

## Router, pauses

| # | Edge | State |
| --- | --- | --- |
| R7 | pause on the contract | done |
| R8 | pause on the plan | done |
| R9 | pause on the outcome, before the request | done |
| R10 | `interactive` dispatch limited to producers of those three, clarifying and formalizing included | done |
| R11 | every other step dispatched in `auto` | done |
| R12 | a spec is how Frame formalizes the contract, never a fourth artifact | done |
| R13 | a dispatched step asks and waits as its own instructions say | done |
| R14 | a step that ends without waiting, so the orchestrator waits on its result | done |
| R15 | pause again on an artifact produced anew | done |

## Router, refusals

| # | Edge | State |
| --- | --- | --- |
| R16 | a refusal is a finding against the artifact | done |
| R17a | a refused spec goes to Frame | done |
| R17b | a refused contract goes to Frame | done |
| R18 | a refused plan goes to Deliver | done |
| R19a | a refused outcome goes to Deliver | done |
| R19b | a refused outcome goes to Frame when it changes what is built | done |
| R20 | nothing bounds the loop but the user | done |

## Router, discipline

| # | Edge | State |
| --- | --- | --- |
| R21 | read only the current zone reference | done |
| R22 | verify a provider is installed before calling it | done |
| R23 | spawn specialized agents for isolated work | done |
| R24 | parallelize independent work | done |
| R25 | repeat the responsible zone on an actionable gap | done |
| R26 | the step-end marker only once the draft request exists | done |

## Frame

| # | Edge | State |
| --- | --- | --- |
| F1 | the source references a ticket, so resolve it | done |
| F2 | no ticket, so the source as provided | done |
| F3 | planning-ready, so straight to the contract | done |
| F4 | intent can change what is built, so clarify | done |
| F5 | only contract requirements missing, so formalize | done |
| F6 | clarifying feeds formalizing | done |
| F7 | formalizing yields the contract | done |
| F8 | a resolved ticket is declared in the delivery folder | done |
| F9 | no ticket, so nothing is declared | done |

## Deliver

| # | Edge | State |
| --- | --- | --- |
| D1 | the contract becomes a proportional plan | done |
| D2 | the plan goes to one executor | done |
| D3 | implementing feeds asserting | done |
| D4 | architecture conformance whenever the project documents architecture | done |
| D5 | no journey required, so commit | done |
| D6 | a journey is required, so run it last | done |
| D7 | the journey succeeds, so commit | done |
| D8 | the journey fails, so back to the executor | done |
| D9 | commit the validated work | done |
| D10 | only a clean committed candidate reaches Check | done |
| D11 | the assert repair loop iterates until it passes | done |
| D12 | a blocking condition sets the plan blocked and stops | done |
| D13 | any mismatch with the plan reports a replan | done |
| D14 | the tree is never dirty at a phase boundary | done |

## Check

| # | Edge | State |
| --- | --- | --- |
| C1 | one fresh checker, independent from implementation | done |
| C2 | the review clears, so challenge the outcome | done |
| C3 | the review returns actionable findings | done |
| C4 | the outcome is trustworthy, so open the draft request | done |
| C5 | the challenge returns actionable findings | done |
| C6 | product or contract findings become the next Frame source | done |
| C7 | independent implementation findings go through Todo | done |
| C8 | dependent repairs stay together in Deliver | done |
| C9 | Todo feeds Deliver | done |
| C10 | Check is re-entered after every new candidate | done |
| C11 | the request opens only when nothing is actionable | done |

## The six edges an earlier harness could not reach

Each was unreachable because of a constraint the harness imposed, not because of anything the orchestration does. Three further sandboxes lift those constraints.

| Edge | Constraint that hid it | How it is lifted |
| --- | --- | --- |
| `R23`, `C1` | subagents forbidden, so the orchestrator stayed observable and the checker was never independent | one sandbox requires spawning: delivery to one agent, review to a fresh one fed only the inputs the Check reference names |
| `C4`, `C11`, `R26` | no remote and no forge, so the request never opened and the step-end marker never fired | one sandbox carries a real bare remote with `main` already pushed, and a `gh` that answers `pr create` while logging every call |
| `R5` | no real cost and nothing irreversible | one sandbox declares a metered API with no free tier and a key it does not hold, and a module three external consumers depend on |
| `R24` | read as a performance clause rather than a behaviour | the same sandbox asks for three helpers that share nothing, with fan-out permitted |
