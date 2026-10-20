---
status: done
---

# Report by tool

## Need

Claude Code and Codex calls are summed in one report. Every stored call already says its `tool` (`claude-code` or `codex`), but no axis shows it and no filter keeps one: the model axis tells them apart only by model names.

## Decision

The tool becomes one more axis and one more filter, like the model.

- `aidd telemetry report --axis tool`: one row per tool.
- `aidd telemetry report --tool <claude-code|codex>`: only that tool's calls. A closed set, refused otherwise like `--agent`.
- Envelope: still version 2, an addition. `filters` gains `tool` as its last key, `null` when not given, else the tool. The axis value is the stored `tool`, never absent.
- The text report names the active filter like the others.
- Docs: `envelope.md` (axes, the `filters` row and its order), the `01-usage` skill wherever it lists axes or filters, the usage contract's report section.

## Properties

| # | Property | Tested by |
| --- | --- | --- |
| T1 | Every row of `--axis tool` is selectable by `--tool`, and the filtered report's totals equal that row | the existing drill-down property, with the tool axis and Codex records in its generators |
| T2 | `--axis tool` adds up to the same totals as every other axis | the existing partition property |
| T3 | A bounded report filtered by tool equals the full report filtered by tool | the existing bounded-equals-full property |
| T4 | Every existing report, axis and filter prints byte for byte as before, but for the added `filters.tool: null` | existing goldens and e2e, updated for that one key only |

## Out of scope

- Telling the surfaces of one tool apart (CLI, desktop app, IDE extension).
