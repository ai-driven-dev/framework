# 02 - Recommend

Find the smallest reusable efficiency improvements.

## Input

Transcript, verified sources, and measurements.

## Output

Verified edits with a title, relative source path, exact before/after, and short execution prompt.

## Process

1. **Reflect.** Ask yourself:

> Based on the conversation, what shorter, equally reliable path could have achieved the same result, and what minimal reusable change would reduce time, tokens, or cost next run?

## Rules

- Prefer removal or consolidation over new instructions.
- No useful edit means no recommendation.
