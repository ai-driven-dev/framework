---
status: done
---

# Instruction: The on use case takes an identity choice and writes it only on success

## Architecture projection

```txt
cli/src/contexts/telemetry/
├── domain/ports/identity/git-user-source.ts           ✅ proposal: user.name else user.email in a directory, or null
├── infrastructure/…git-user-source-adapter.ts         ✅ `git config user.name` / `user.email` in cwd
├── application/switch/telemetry-on-use-case.ts        ✏️ execute(cwd, choice); writes identity only on `on`; result names identity before/after
└── composition wiring                                 ✏️
cli/tests/…                                            ✏️ use-case + adapter integration (real temp git repo, GIT_CONFIG_NOSYSTEM=1, sandboxed HOME)
```

## Tasks

1. Red first: refused `on` with `{set}` writes nothing; `on` with `{set}` writes it and reports previous; `none` with identity set is refused before any write; `keep` writes nothing; proposal rejected by `personIdOf` returns null; adapter reads local over global, name over email. Record red.
2. Code to green. Show the write guard is a guard (remove it, see the refused-writes-nothing test fail).
