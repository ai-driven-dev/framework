---
status: done
---

# Instruction: Room in the bundle, measured first

## Architecture projection

> ✏️ modify

```txt
cli/src/
├── presentation/commands/telemetry.ts                          ✏️ commandOf: one wiring and error path; filterOption takes what a flag keeps
├── presentation/display/telemetry-display.ts                   ✏️ leftOutLines, count, grouped, shared sentences
├── presentation/display/telemetry/telemetry-report-display.ts  ✏️ prints leftOutLines
├── presentation/display/telemetry/telemetry-lifecycle-display.ts ✏️ shared sentences
├── contexts/telemetry/domain/report/{report-filter,usage-report}.ts ✏️ filtersOf; counters folded over COUNTERS
├── contexts/telemetry/application/report/report-envelope.ts    ✏️ same
├── contexts/telemetry/infrastructure/{consent/clone-identity-reader,git-repository-locator-adapter,forget/measurement-erasure-adapter}.ts ✏️ isAbsent
└── kernel/reading/text-file.ts                                 ✏️ isAbsent
```

## Steps

1. Measure `dist/cli.js` on `origin/next`: 710,636 B, 1,044 B under 695 KB.
2. Rank telemetry modules by bytes in the bundle (esbuild metafile).
3. Fold duplication, output unchanged but for `ingest`: thousands grouped, snapshot line first.
4. Run the display, wiring and telemetry tests after each step.
