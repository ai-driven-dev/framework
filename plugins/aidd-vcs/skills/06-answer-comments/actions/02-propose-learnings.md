# 02 - Propose Learnings

Propose the feedback that should outlive the pull or merge request, and post the summary.

## Input

The threads answer-comments replied to, the ones it handed over, and prior resolved review threads and summary.

## Process

1. Sort the feedback per [learnings.md](../references/learnings.md), including prior resolved threads.
2. Fill `comments-summary-template.md` from the review history, retaining settled counts and learnings across runs.
3. Post the summary with its marker, or edit the one already posted.
   - Summary posted: edit only one carrying the marker and authored by the current account.
   - Several summaries match: stop and ask which to update.
   - None matches but an unmarked comment by this account opens with `## Review comments`: ask before adopting it or posting another summary.
   - None at all: post one.
4. If there are learnings, propose running the skill that captures durable project learnings with this summary as input.

## Output

One summary comment on the pull or merge request, shaped by [comments-summary-template.md](../assets/comments-summary-template.md) and kept up to date across runs.

## Rules

- Keep learnings as proposals and never write a rule, memory or skill.
