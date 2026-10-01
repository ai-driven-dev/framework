# Mass campaign

Forty-one independent headless runs against the final text, grouped so that each group measures dispersion rather than presence. A behaviour observed once is an anecdote; a mode that pauses nine times out of ten is unusable.

## Protocol

Every run gets its own sandbox, built from one script so nothing differs between them, and reports in `KEY=value` lines so the aggregation is mechanical rather than a reading impression. No run may push, open a request, call the forge, or spawn agents, and none may invent a user approval.

| Group | N | What it varies | What it measures |
| --- | --- | --- | --- |
| G1 | 10 | nothing, the same request in `interactive` | does the first pause land on the same artifact every time |
| G2 | 10 | nothing, the same request with no mode word | does the autonomous mode really never stop |
| G3 | 8 | the shape of the request, one form per run | does the mode sentence decide by text or by judgement |
| G4 | 6 | how a finding recurs | does the recurrence clause bound the loop, and can it be escaped |
| G5 | 7 | which artifact is refused and how | does a refusal always reach the same zone |

G3's eight forms: the word inside the prose, a word that merely starts like it, the bare word alone, upper case with dashes, both words, the word trailing, surrounding whitespace, and a near-miss prefix.

G4's six: a plain recurrence twice over, a recurrence whose repair failed, a recurrence reworded to escape the clause, a recurrence two passes back, and a recurrence under `interactive`.

G5's seven: a refused contract, a refused plan, a refused outcome that changes what is built, a refused outcome that is a repair, a refusal naming what the artifact already carries, three refusals of the same plan in a row, and a refused outcome verified true before acting.

## Why the mode words are measured this hard

Three forms used to be decided by the reader rather than by the sentence, and one of them corrupted the source silently: a request opening with an ordinary word that merely starts like the default mode lost its first word on the way to framing. The sentence now matches a whole word, strips it from the source, and refuses a request that carries nothing else. Each of those three properties has its own run.

## Results

| Group | N | Outcome |
| --- | --- | --- |
| G1 | 10/10 | every run selected `interactive`, paused on the contract, and took Frame's direct branch |
| G2 | 10/10 | every run selected `auto`, paused zero times, took the direct branch, wrote one phase |
| G3 | 8/8 | the sentence decided every form by itself |
| G4 | 6/6 | the recurrence stopped the loop every time, including when the repair had failed and when the recurrence was two passes back |
| G5 | 7/7 | every refusal reached the zone the sentence names |
| T | 3/3 | the shortened text behaves as the long one did, and the request gate no longer contradicts it |

Forty-four runs. No dispersion on anything load-bearing: the mode selected, the artifact a pause lands on, the branch Frame takes, the zone a refusal reaches. The one outlier in the whole series is a single run reporting three self-answered questions where nine reported none, and it concerns what that run counted as a question rather than what it did.

## What the mass caught that a single run could not

- A request opening with an ordinary word that merely starts like the default mode used to lose that word on the way to framing. Eight forms now resolve by the sentence alone, where seven of fourteen once needed the reader.
- A recurring finding whose repair had failed was covered by no wording, so the autonomous mode looped without bound. The clause now reads on the recurrence rather than on the repair.
- Two refusals of one artifact in a row leave the plan growing a phase per pass, with nothing bounding it but the person. That is what the text says, and it is now measured rather than assumed.
- Whether a refusal leaves any trace on disk is not deterministic: one run left one, another left none, from the same text. The gap is not only that no rule requires a trace, but that its absence cannot be read as meaning no refusal happened.

## What stayed decided by the reader

Two clauses, both resting on a distinction the Check reference leaves undefined for its own three routes. A refused outcome goes to Deliver or to Frame depending on whether it changes what is being built, and one run in seven judged that rather than read it. A finding reworded between passes is the same finding or a new one by the reader's call. Tightening either would invent a test its neighbours do not have.
