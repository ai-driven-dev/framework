# Design fixes

Four defects the case battery surfaced in zones this change did not own, fixed here because leaving them left the mode promising something the flow could not deliver. Each is one sentence, and each is proved by the sandbox that first revealed it.

## What was wrong, and what it is now

| Defect | Fix | Proved by |
| --- | --- | --- |
| Frame's spec and Check's review had no committer, so a request could be opened without the contract it was built from or the review that cleared it | each zone commits what it wrote before handing over | a run through a real remote and a forge stub: both files committed, nothing untracked, both reachable on the pushed branch |
| Whether an end to end journey was required rested on a file no zone reference points at, so a run that obeyed the reading rule would skip it | a journey is required when the project's testing memory names one for a surface the change touches, and not otherwise | one run with that memory took the journey and cited the line; one without it took the other edge, both by text rather than by judgement |
| `planning-ready` decided whether a spec is written at all, and therefore how often a person is consulted, with no test behind it | three tests, all of which must hold: the source names the artifact to change, states the observable outcome, and leaves open no decision that changes what is built | the same request stayed on the direct branch in two runs with all three tests met, while a deliberately vague one took the clarify branch with two of three failing |
| The request gate read "no actionable finding", and a strict checker always had one, so two earlier runs looped four times each and never reached it | once the review has cleared, only a finding that contradicts the contract reopens a zone; any other is carried onto the request as a note | a run whose first finding contradicted its contract reopened delivery, whose second did not was carried as a note, and which then reached the gate |

## Why the loop is bounded without a count

A pass budget was considered and rejected: the number would be arbitrary, and a run that hit it would stop for a reason no one could defend. Severity needs no number. It also matches what the unbounded runs actually produced — their later rounds were about inputs their contracts never mentioned, a superscript digit, a vulgar fraction, the direction of a flag. None contradicted anything that had been agreed. The first round of each did, and under this rule it still reopens.

## What the third test is careful not to say

It reads "no decision that changes what is built", not "no decision". Every request leaves something open; demanding none would send the smallest change through formalizing, and twenty runs that had settled on the direct branch would have flipped. The qualifier is Frame's own wording, taken from the sentence one line below it, so the test introduces no new vocabulary.

## Still not fixed, deliberately

Delivery commits and pushes before the review runs, so a rejected candidate can already sit on the remote. Relocating that push was tried, challenged and reverted: on a feature branch nobody reads before the request exists, it bought almost nothing and cost another plugin's contract. The observation stands and the remedy did not.

The phase commit is still claimed by two documents. The coverage hole is closed, which was the part that lost artifacts; what remains is one fact stated twice, and the implement skill is being rewritten elsewhere.
