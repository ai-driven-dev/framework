# Journey evidence

Nothing here evaluates the validator, and no gate reads prose, so each case is run as fresh
`claude -p` contexts given the skill text and the task, outside the repository. Criteria
fixed before running, no run repeated, every count below mechanical.

## Placement - pass

22 drafts, three requests, both text versions. Markers outside the open questions section:
**0**. Heading exact: **22/22**, though only the template names it.

## Driving to zero - pass

A request answering every required field. Entries listed:

| text | runs |
| --- | --- |
| shipped | 0, 0, 0 |
| before the cut | 3, 2, 0 |

The shipped text reaches `None` on a resolved request three times out of three.

On the thin request that answers the same fields but states no non-goals, the shipped text
lists 2, 3, 2, 2, 4 entries and the pre-cut text 3, 4, 3, 4, 5. **No causal claim is made.**
The cut changed several clauses at once, so length is not isolated, and the ranges overlap.

## The measured case - pass

Retention and the row cap left open, the two #626 measured: **2, 2, 2** entries, both versions.

## Refine - pass

| Finding | Result |
| --- | --- |
| answers one of two | the entry is gone, the other stays, 3/3 |
| answers one in part | narrowed to what remains, 3/3 |
| answers the last | `None`, 3/3 |
| spec carries no such section | the section is added, heading exact, 3/3 |

The last two rows failed before this round. Cutting `None` from step 4 produced an empty
section 3/3, which the validator then refuses, and refine never linked the template, so it
wrote `## Open questions` 3/3.

## The validator - pass

Fresh context, the yml and one spec. Stands in for the gate #625 brings.

| Spec | Verdict |
| --- | --- |
| one residual entry | invalid 3/3 |
| `None`, with a marker under `## Context` | invalid 3/3 |
| no open questions section at all | invalid 3/3 |
| `None`, every required section resolved | valid 3/3, and 3/3 again on a fuller spec |

The fourth row failed while the yml carried no definition of a gap: an evaluator reading it
alone supplied its own, and refused a spec whose content was complete.

## Not measured

The installed skill, routed through `SKILL.md` by a real session. One model. And no judge
classified the entries, so which gaps a draft raises rests on reading them.
