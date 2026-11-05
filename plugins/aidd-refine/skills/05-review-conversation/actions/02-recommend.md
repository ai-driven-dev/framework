# 02 - Recommend

Find the smallest reusable improvements, each attributed to its owner.

## Input

Transcripts, session reports, verified sources, and measurements.

## Process

1. Give each finding one owner: the framework text the model read, the brief the orchestrator wrote, the host or environment, or the project. Verify provenance: project-owned guidance is not framework text merely because it contains instructions. Only the first two take a proposed text edit; host and project findings may include an operational remedy and its validation, without a patch or an acceptance checkbox.
2. Ask yourself:

   > Based on the conversation, what shorter, equally reliable path could have achieved the same result, and what minimal reusable change would reduce time, tokens, or cost next run?

3. For each finding, connect the recorded evidence to the cause (established, hypothesis, or unknown), the observed impact, the smallest remedy and the check that would validate it. Distinguish a recorded failure from a proven explanation, and a proposed check from one already run. State a material tradeoff when it changes the decision; do not add fields merely to fill the template.

## Output

Findings ordered by observed impact, with unknown cost left unknown. Each has evidence, cause status, owner, minimal remedy and validation. Framework-text and delegation-brief edits also include the verified relative source path, exact before/after and a short execution prompt.

## Rules

- Prefer removal or consolidation over new instructions.
- Every finding cites its session and message sequence. A claim that framework text or a delegation brief caused it also cites the instruction actually read; do not invent that attribution for a host or project failure.
- If no supported improvement is found, say so; do not manufacture an edit to populate the report.
