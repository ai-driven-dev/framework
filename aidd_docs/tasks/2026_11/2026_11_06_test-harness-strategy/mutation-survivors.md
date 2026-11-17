# Mutation survivors, argued

Survivors of the mutation scopes that are closed by a proof instead of a test, with the line that carries the proof. A survivor killed by a test is not listed: the test names it. Paths are under `cli/src/`.

## orchestration

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `orchestration/clean/clean-user-scope.ts:70`, `if (manifestFound)` replaced by `true` | equivalent | `manifestFound` is `manifest !== null` (`contexts/installation/application/purge-user-scope-files.ts:73`). With no manifest, `proveWithdrawals` returns `[]` (same file, line 85). `assertUserHostsReachable` (`contexts/host-registration/application/withdraw-from-host.ts:548`), `proveUserRegistrations` (563-567) and `withdrawUserRegistrations` (634, then `purgeMarketplaceCaches` over an empty map, 663) only loop over their argument, so all three do nothing on `[]`. The only difference is one extra manifest read that answers `null`. |

## machine-claims

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `contexts/machine-claims/infrastructure/user-source-references-adapter.ts:36` and `:48`, `[]` replaced by a one-element array | equivalent | The element is a string no project root equals, so the `some` at 36 stays false and the `filter` at 48 drops it. |
| `user-source-references-adapter.ts:72`, `[]` replaced by a one-element array | equivalent | The `fileExists` filter at 77 drops the element, a path that does not exist. |
| `user-source-references-adapter.ts:46` and `:65`, `length > 0` replaced by `true` or `>= 0` | equivalent | An empty version reaches `write`, and `pruneVanishedRoots` drops every version with no existing root (line 115) before the file is written. |
| `user-source-references-adapter.ts:132`, `"it is not valid JSON"` replaced by `""` | limit | The fallback applies only to a thrown value that is not an `Error`. `JSON.parse` always throws a `SyntaxError`. |
| `contexts/machine-claims/application/native-plugin-ownership.ts:48`, `if (changed)` replaced by `true` | equivalent | `setNativeRegistrations` stores a value deep-equal to the one it replaces (`contexts/installation/domain/manifest.ts:160-164`), and the save at line 51 still reads the real flag. |
| `contexts/machine-claims/application/plugin-removal-claims.ts:59`, `[]` replaced by a one-element array | equivalent | The element's `name` is `undefined`, so `m.name === marketplaceAlias` never matches, as with an empty list. |
| `contexts/machine-claims/application/user-scope-plugin-files.ts:99`, `posix.isAbsolute(rel) \|\|` replaced by `false`, or `\|\|` by `&&` | limit | An absolute `rel` fails the `startsWith(`${pluginName}/`)` test at line 102 unless the plugin name itself starts with `/`, which no installed plugin name does. |
| `user-scope-plugin-files.ts:109`, `while (true) {}` emptied | detected | Scored as a timeout: the loop never ends, so the run is killed. |

The duplicate guard in `shared-framework-source.ts` and the equal-path line in `user-scope-containment.ts` were deleted instead of argued: the first re-checked what the method had just narrowed, the second returned `false` for a case `relative` already answers with an empty string.

## translate

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `contexts/translate/domain/engine.ts:348`, skills branch condition replaced by `false`, and its `"skills"` literal replaced by `""` | equivalent | `markdownSection(kind)` is `capabilities[kind] ?? null` and `skillsSection()` is `capabilities.skills ?? null` (`contexts/tools/domain/profile/define-tool.ts:306-307`). Both branches read the same value, the condition is a spelling. |
| `contexts/translate/domain/engine.ts:393`, trailing `$` dropped from the command-prefix regex | limit | `.+` does not cross a newline, so the two regexes differ only for a command name holding one. No plugin manifest holds such a name. |
| `contexts/translate/infrastructure/schema-validator.ts:38`, `validateFn.errors ?? []` | limit | ajv sets `errors` whenever the data is invalid, and the branch runs only then. The fallback is a type-level guard. |
| `contexts/translate/infrastructure/schema-validator.ts:39`, `e.message ?? "unknown error"` | limit | ajv always sets `message` (`messages: false` is not configured). Same type-level guard. |

A limit is a case no real input reaches. If one does, the mutant stops being equivalent and a test replaces the limit.
