---
status: done
---

# Instruction: The foreign clock guard

## Architecture projection

```txt
cli/scripts/test-foreign-clock.mjs   🆕 checks the child sees a foreign zone and locale, then runs the telemetry tests under them
cli/package.json                     ✏️ test:foreign-clock
.github/workflows/cli-ci.yml         ✏️ one step in cli-coverage
```

## Proof

Two hand mutations: the ledger's day read in local time (the guard fails 36 tests; on `origin/next` the default suite passes it), and counts grouped by the default locale (the default suite passes it, the guard fails 24). See [`evidence.md`](./evidence.md).
