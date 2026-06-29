# 01 - Clarify scope

Close the gaps in the request through Product Owner questioning, then decide whether it is an epic or a single story.

## Input

A free-text feature or epic description. Optionally, ids of related existing stories to consider.

## Output

A confirmed scope statement: the problem, the in-scope outcomes, the named constraints, and a flag marking the request as an epic (multiple stories) or a single story.

## Process

1. **Read.** Restate the request in one sentence to surface the implicit need.
2. **Question.** Cover problem, outcomes, criteria, scope edges, and constraints.
3. **Iterate.** If a blocking question remains, loop back to step 2. Otherwise proceed.
4. **Classify.** Judge the breadth. Flag the request as an epic when it spans more than one independent outcome, otherwise as a single story.
5. **Confirm.** Show the scope statement and the epic-or-single flag. Wait for the user to confirm before handing to `02-split-epic`.

## Test

- The output names the problem, the in-scope outcomes, and the constraints.
- The output carries an explicit epic-or-single flag confirmed by the user.
- No blocking question is left open when the action proceeds.
