# 01 - Interview

Frame the decision with the PM before any data is read.

## Input

A pending decision, a topic to track, or the current context.

## Output

A decision frame kept in context: question, deadline, options, current belief, change-of-mind criteria, topics, population, sources, and window.

## Process

1. **Resolve.** Infer the decision from the current context; otherwise ask what decision is at stake and wait.
2. **Qualify.** When no decision can change with the answer, apply [handoffs](../references/handoffs.md) and stop.
3. **Ask.** Walk [interview](../references/interview.md) one question at a time, skipping what the context already answers.
4. **Anchor.** Restate the PM's current belief and change-of-mind criteria in their words before any source is read.
5. **Inventory.** List the reachable sources per [sources](../references/sources.md) and confirm access to each with the PM.
6. **Confirm.** Show the frame and wait for corrections.

## Test

| Case | Pass |
| --- | --- |
| No decision named | exactly one question asked; no source read; workspace unchanged |
| The PM asks for a dashboard right away | the frame questions come first; no item collected |
| Frame shown | it holds at least two options, one being doing nothing, and one change-of-mind criterion |
| A source is unreachable | it is listed as a gap with an export or paste alternative |
| No decision at stake | no frame built; the handoff is offered and the run stops |
