# Question angles

Prompt banks grouped by topic, to draw from when a thread runs that way. Not a checklist to complete. Pick what fits the live thread, rephrase to the user's domain and altitude, never dump the whole list.

## Problem and goal

- What changes once this works, and for whom?
- What does this solve that nothing today solves?
- How will you know it was worth doing?

## Actors and parts

- Who or what triggers this?
- Who or what is affected when it runs?
- Which other system, service, or component takes part?

## Scope and boundaries

- What is the smallest version that still counts as done?
- What is explicitly out of scope for this iteration?
- Where does this feature stop and another begin?

## Success criteria

- How do we verify each behavior works?
- What is the measurable bar, a number, a state, a result set?
- What does a failing case look like?

## Constraints and dependencies

- What must already exist for this to run?
- What limits apply, time, cost, platform, data?
- What prior step or external service does this rely on?

## Edge and failure modes

Walk these one at a time, keep only the ones that would change what gets built.

- Boundaries: empty, zero, maximum, one over the limit, duplicate?
- Concurrency: two actors at once, out-of-order, a repeated request?
- Failure: a step fails, a service is down, a timeout, a partial write?
- Bad input: invalid, malformed, or hostile, and how should it answer?
- Absence: the actor offline, the data missing, the dependency not ready?
