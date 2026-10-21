# 02 - Recommend

Find the smallest reusable improvements, each attributed to its owner.

## Input

Transcripts, session reports, verified sources, and measurements.

## Output

Findings ordered by cost, each with its evidence, its owner, and when the owner is a maintained file, a verified edit: title, relative source path, exact before/after, and short execution prompt.

## Process

1. **Attribute.** Give each finding one owner: the framework text the model read, the brief the orchestrator wrote, the host or environment, or the project. Only the first two take an edit; the others are reported as they are.
2. **Reflect.** Ask yourself:

> Based on the conversation, what shorter, equally reliable path could have achieved the same result, and what minimal reusable change would reduce time, tokens, or cost next run?

## Rules

- Prefer removal or consolidation over new instructions.
- A finding without a message sequence and the instruction the model read is not a finding.
- No useful edit means no recommendation.
