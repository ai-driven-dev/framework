---
status: done
---

# Plan: report by tool

Authority: [contract.md](contract.md) (T1-T4). Slim task folder: this plan holds its phases, [evidence.md](evidence.md) the red run and the gates.

## Phases

1. **Tests first.** Draw `tool` per call in the report property generators (it was call parity), add `tool` to their filter generators, and pin the axis, the filter, the `filters` key order, the `Selected:` line and the `--tool` flag in unit and wiring tests. Watch them fail for the missing axis.
2. **Axis and filter.** `tool` joins `REPORT_AXES` (last), `FILTER_AXES` and `NO_FILTERS` (last key), `axisValueOf` returns the stored `tool`. `--tool` is a closed-set option over `USAGE_TOOLS`, like `--agent`. The text report labels it through the existing axis label table.
3. **Goldens.** The `--help` golden gains the `tool` choice and the `--tool` line; the narrowed e2e states `filters.tool: null` and drills down the tool axis. Nothing else printed moves (T4).
4. **Docs.** `envelope.md` (axes, `filters` order), `01-usage` (`SKILL.md` description, `frame.md` axis and filter tables), plugin README, usage contract filters table. No counters.
5. **Gates and mutation.** As listed in evidence.md.

## Out of scope

Telling the surfaces of one tool apart (contract).
