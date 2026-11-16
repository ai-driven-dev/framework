# Mutation survivors, argued

Survivors of the mutation scopes that are closed by a proof instead of a test, with the line that carries the proof. A survivor killed by a test is not listed: the test names it. Paths are under `cli/src/`.

## orchestration

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `orchestration/clean/clean-user-scope.ts:70`, `if (manifestFound)` replaced by `true` | equivalent | `manifestFound` is `manifest !== null` (`contexts/installation/application/purge-user-scope-files.ts:73`). With no manifest, `proveWithdrawals` returns `[]` (same file, line 85). `assertUserHostsReachable` (`contexts/host-registration/application/withdraw-from-host.ts:548`), `proveUserRegistrations` (563-567) and `withdrawUserRegistrations` (634, then `purgeMarketplaceCaches` over an empty map, 663) only loop over their argument, so all three do nothing on `[]`. The only difference is one extra manifest read that answers `null`. |

## translate

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `contexts/translate/domain/engine.ts:348`, skills branch condition replaced by `false`, and its `"skills"` literal replaced by `""` | equivalent | `markdownSection(kind)` is `capabilities[kind] ?? null` and `skillsSection()` is `capabilities.skills ?? null` (`contexts/tools/domain/profile/define-tool.ts:306-307`). Both branches read the same value, the condition is a spelling. |
| `contexts/translate/domain/engine.ts:396`, `colonIdx !== -1` replaced by `true` | equivalent | With `colonIdx === -1`, `name.slice(0)` returns `name`, which is what the fall-through returns. |
| `contexts/translate/domain/engine.ts:393`, trailing `$` dropped from the command-prefix regex | limit | `.+` does not cross a newline, so the two regexes differ only for a command name holding one. No plugin manifest holds such a name. |
| `contexts/translate/domain/engine.ts:241`, `[]` replaced by a one-element array | limit | The branch runs only when `hooksInstallPath` answers `null`, which a flat profile does when its hooks delivery declares no flat directory (`contexts/tools/domain/profile/plugin-answers.ts:112,125`). Measured over the registered profiles: opencode, kilo and antigravity (the flat ones) all answer a path for a hook script. No profile reaches the branch. |
| `contexts/translate/application/sink/disk-sink.ts:438`, `existing !== null` replaced by `true` | equivalent | `assertParsableJson(null, ...)` runs `JSON.parse(null)`, which parses the text `null` and does not throw (`disk-sink.ts:544-551`), the same as skipping the call. |
| `contexts/translate/infrastructure/schema-validator.ts:38`, `validateFn.errors ?? []` | limit | ajv sets `errors` whenever the data is invalid, and the branch runs only then. The fallback is a type-level guard. |
| `contexts/translate/infrastructure/schema-validator.ts:39`, `e.message ?? "unknown error"` | limit | ajv always sets `message` (`messages: false` is not configured). Same type-level guard. |

A limit is a case no real input reaches. If one does, the mutant stops being equivalent and a test replaces the limit.
