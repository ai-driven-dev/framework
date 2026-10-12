# The supervised flow, run with someone answering it

Every earlier run was headless, so the three gates were only ever read. This one
had an interlocutor: the run stopped at each pause and reported what it was
presenting, the answer arrived as a message, and it continued from there. Nobody
invented an approval.

The source was deliberately not planning-ready — `interactive add rate limiting
to the public API`, against a one-route API with no auth — so the clarify then
formalize path ran, which no headless run had ever counted.

## What the run did

| | |
| --- | --- |
| Pauses | 5, on 3 artifacts |
| Step waits that were not pauses | 2, both the clarifying step's own |
| Commits | 10, every zone committing what it wrote |
| Tests | 17, green under the project's own command |
| Pull request | not opened: the request itself was forbidden, so the run stopped at the gate |

- **Contract**, once. Presented in full, approved with a correction: the contract
  never said whether a request already refused counts, so a caller could buy
  itself capacity by sending harder. The correction was carried into the spec and
  the contract was not presented again.
- **Plan**, twice. Presented, then refused on a seam the plan itself had flagged —
  an export whose only consumer was a test, against a contract whose non-goals
  said there was no configuration surface. Reworked, re-presented, approved.
- **Outcome**, twice. Presented, then routed back to Deliver: the limiter kept one
  entry per source address and nothing evicted it, so on an unauthenticated API an
  attacker with address space turns a request limit into memory growth against the
  process it protects. Swept, re-checked, re-presented, approved.

Nothing asked anything between the plan's approval and the outcome, repairs
included.

## Which rules this exercised

| Rule | How |
| ---- | --- |
| A step's own waits are part of producing the artifact | the clarifying step asked twice and the run answered that neither was one of the three pauses, quoting the rule |
| The pause is on the finished artifact, taken by you where no step presents it | `aidd-pm:04-spec` returns a path and notes, so the orchestrator took the contract pause itself and said why |
| An approval ships what was presented, with any correction it carries | the contract's correction shipped without a second presentation |
| An artifact produced anew pauses again | both the plan and the outcome came back to their own pause |
| Three pauses, one per artifact | five stops, three artifacts, and the two re-presentations were the same artifact produced anew |
| An exception says what was withheld and what would release it | the isolated executor and the independent checker were both withheld by the no-subagent rule, and the run said its review's independence was therefore nominal rather than structural |
| A finding already acted on is a decision that requires user authority | the memory growth had been accepted as a line in Risks at the plan pause; the run asked again once it was running code, and did not decide for the user |

## What the run got wrong, and said so

- Three throwaway probe scripts were written outside the sandbox, then deleted.
  Their evidence stood; their location did not.
- A mutation was measured twice against a tree whose implementation an intervening
  `git checkout` of an uncommitted file had silently reverted, so the first result
  proved nothing. Re-run against the committed file with an anchor assertion, it
  failed two named tests, and the challenge record says which.

Both were volunteered, not caught by the reviewer. A run that reports its own
invalid evidence is worth more than one whose record reads clean.
