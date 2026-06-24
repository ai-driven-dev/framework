# 02 - Stats

Show real token usage and estimated savings for the current session under condense mode. On Claude Code the bundled `hooks/condense-stats.js` hook owns this path; the model runs the steps below only on tools without hook support.

## Input

- The session's assistant messages since it started.
- The active level and every on/off switch during the session.

## Output

A stats block reporting, in order: mode, active turns and ratio, tokens out while active, tokens out while off, average saved per turn versus the unmodified baseline, approximate total saved, and per-level top savings.

## Process

1. **Read.** Load the session log for the current AI tool (Claude Code: the active session JSONL; other tools: their equivalent transcript).
2. **Detect.** Scan assistant messages for the confirmation line emitted by `01-condense` (`Condense: ON (...)` / `Condense: OFF`). Build a timeline of `(turn_index, level)` segments.
3. **Tokenize.** Count tokens per assistant message. Use the AI tool's token counter when available, otherwise approximate at 4 chars per token.
4. **Compute.** For each `active` segment, estimate the verbose-prose baseline using the level's compression ratio (`lite ~18%`, `full ~38%`, `ultra ~58%`, published averages, replaceable by measured ratios when available).
5. **Render.** Emit the report with the exact field order shown in `## Output`. Round percentages to whole numbers; round token counts to the nearest 10.
6. **Stop.** Do not invoke any other action.

## Test

Output follows the `## Output` field order, every numeric field is filled (no `-`), and the active-turns ratio matches the detected intensity transitions.
