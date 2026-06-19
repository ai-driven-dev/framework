# 02 - Assess

Score each candidate, propose where it goes, and let the user decide every one.

## Input

The candidate lessons from action 01, each with its source.

## Output

A plan the user has approved: the lessons to keep, each with its destination.

## Process

1. **Score.** Give each candidate a relevance score from 0 to 10 with a one-line reason. Weigh how durable it is, how far it generalizes beyond this task, and whether it extends or contradicts existing context.
2. **Propose and reconcile.** For each candidate, name the destination it fits (Memory, Decision, Rule, or Skill, see the skill's Destinations). Then read that destination's current content and classify the candidate against it: new, already covered, or a change to what is there. A reworded repeat of something already captured is already covered, not a new lesson, even when the existing wording differs. A candidate that reverses an existing entry supersedes it.
3. **Ask.** Show the candidates sorted by score, each with its score, reason, destination, and how it reconciles (new, already covered, or supersedes). Recommend the bar at 6 of 10 and recommend skipping the already-covered ones. For every candidate, let the user keep it, move it to another destination, or skip it. Write nothing anywhere until the user has decided. Block on the answer.

## Test

- Every candidate carries a score, a reason, a proposed destination, and a reconcile classification against that destination's current content, and the action writes nothing before the user has decided each one.
