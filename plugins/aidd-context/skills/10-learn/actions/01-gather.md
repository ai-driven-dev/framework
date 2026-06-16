# 01 - Gather

Pick where the learning comes from, collect the raw candidates, and drop anything not worth a second look.

## Input

The trigger: the user invoked the skill, or a conversation signal auto-routed to it.

## Output

A list of raw candidate learnings, each tagged with the source it came from. An empty list when nothing surfaced, which ends the skill.

## Process

1. **Pick the source.** Offer three and let the user choose, or take the one the user named:
   - the current conversation, for recent decisions, pivots, and stated conventions,
   - the project's git history, for recent commits or the current branch's diff against the main line,
   - a source the user points at, like a file, a change set, or a range.

   Block on the choice when it is ambiguous. Default to the conversation when the user gives no steer. If the git source yields nothing (not a repository, on the main line with no branch, or an empty diff), say so and fall back to the conversation or ask the user.
2. **Collect.** From the chosen source, pull the raw signals: a stated rule or convention, a decision and its reason, a deprecation, a pivot that cost time, a pattern worth reusing, a pitfall worth avoiding. Read git changes for what changed and why, not line by line.
3. **Drop noise.** Remove anything personal, an AI preference, a routine edit, or already captured in memory, a rule, or a decision. These never reach scoring.

## Test

- The action emits a candidate list where every item names its source, or it prints a one-line skip and ends when nothing survives the noise filter.
