# 02 - Assess

Score each candidate, propose where it goes, and let the user decide every one.

## Input

The candidate lessons from action 01, each with its source.

## Output

A plan the user has approved: the lessons to keep, each with its destination.

## Process

1. **Score.** Give each candidate a relevance score from 0 to 10 with a one-line reason. Weigh how durable it is, how far it generalizes beyond this task, and whether it extends or contradicts existing context.
2. **Propose and reconcile.** For each candidate, name the destination it fits (Memory, Decision, Rule, or Skill, see the skill's Destinations). Then read that destination's current content and classify the candidate against it: new, already covered, or a change to what is there. A reworded repeat of something already captured is already covered, not a new lesson, even when the existing wording differs. A candidate that reverses an existing entry supersedes it.
3. **Show.** Show the candidates sorted by score, each with its reason, destination, and reconciliation (new, already covered, or supersedes). Recommend the bar at 6 of 10 and skipping the already-covered.
4. **Decide.** Let the user keep, redirect, or skip each. Write nothing until they decide; block on the answer.

## Test

- Every candidate carries a score, a reason, a proposed destination, and a reconcile classification against that destination's current content, and the action writes nothing before the user has decided each one.
