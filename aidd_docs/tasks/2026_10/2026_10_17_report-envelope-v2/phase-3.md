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

A hand mutation of `dayOf` to local getters: the default suite stays green, the guard goes red. See [`evidence.md`](./evidence.md).
