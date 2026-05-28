# 02 - Stats

Show real token usage and estimated savings for the current session under condense mode.

## Inputs

- Session log of the current AI tool (assistant messages produced since session start).
- Active intensity level and its on/off transitions during the session.

## Outputs

```text
Condense session stats
----------------------
Mode: ON (full)
Active turns:        18 / 32  (56%)
Tokens out (active): 4,210
Tokens out (off):    5,830
Avg saved / turn:    ~38%   (vs unmodified prose baseline)
Approx total saved:  ~2,650 tokens

Top savings: full (-42%), ultra (-58%), lite (-18%).
```

## Process

1. **Read the session log** for the current AI tool (Claude Code: the active session JSONL; other tools: their equivalent transcript).
2. **Detect intensity transitions** by scanning assistant messages for the confirmation block emitted by `01-condense` (`Condense: ON (...)` / `Condense: OFF`). Build a timeline of `(turn_index, level)` segments.
3. **Tokenize each assistant message.** Use the AI tool's token counter when available, otherwise approximate at 4 chars per token.
4. **Compute the baseline.** For each `active` segment, estimate the verbose-prose baseline using the level's compression ratio (`lite ~18%`, `full ~38%`, `ultra ~58%` - published averages, replaceable by measured ratios when available).
5. **Render the report block** with the exact field order shown in `## Outputs`. Round percentages to whole numbers; round token counts to the nearest 10.
6. **Stop.** Do not invoke any other action.

## Implementation

A `UserPromptSubmit` hook bundled with this plugin at `hooks/condense-stats.js` intercepts the trigger phrase, reads the active session transcript, detects intensity transitions emitted by `01-condense`, computes the report, and returns `{ decision: "block", reason: "<report>" }` so the model is not invoked.

The model only runs this action's inline logic on AI tools that lack hook support; on Claude Code the hook owns the path.

## Test

The output matches the field order in `## Outputs`, every numeric field is filled (no `-` placeholders), and the active-turns ratio is consistent with the detected intensity transitions in the session.
