---
status: done
---

# Phase 2: The hook reads by the same rule

## Architecture projection

```txt
plugins/aidd-telemetry/hooks/lib/git.cjs      ✏️ parseBranchConfig reads declared_for; branchDeclaration returns null unless declared by the command
plugins/aidd-telemetry/hooks/lib/binding.cjs  ✏️ a branch binds when present
scripts/__tests__/fixtures/telemetry-bindings/ ✏️ cases: hand-set task unbound, copied stamp unbound, legacy bound, own stamp bound
scripts/__tests__/aidd-telemetry-hooks.test.js ✏️ gitConfig test reads expected answers, keys written under the case's branch
```

## Tasks

1. Red first: fixture cases flipped and added; both the CLI fixture test and the hook test go red. Record.
2. Code to green. Mutation per guard, recorded.
