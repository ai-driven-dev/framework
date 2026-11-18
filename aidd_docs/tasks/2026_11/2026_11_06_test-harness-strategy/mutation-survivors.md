# Mutation survivors, argued

Survivors of the mutation scopes that are closed by a proof instead of a test, with the line that carries the proof. A survivor killed by a test is not listed: the test names it. Paths are under `cli/src/`.

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

## installation

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `contexts/installation/application/removal/remove-plugin.ts:112`, `ref !== undefined` replaced by `true` | equivalent | The map then holds `[undefined]` for the tool. `detachNativePluginRefs` (`contexts/machine-claims/application/native-plugin-ownership.ts:39`) matches `targeted.has(claim.ref)`, and no claim carries an undefined ref. The only difference is the exclusive access it takes. |
| `remove-plugin.ts:202`, `"user"` replaced by `""` | equivalent | `deletePluginFilesForTool` reads `scope` only to skip a user-scope plugin it does not own (`contexts/installation/application/plugin/plugin-helpers.ts:50`), and `resolveBaseDirFromRecord` answers the user directory for every scope but `"project"` (`plugin-target-resolution.ts:35`). Both give the same directory. |
| `remove-plugin.ts:250-251`, `ref !== undefined` and `registrations !== undefined` replaced by `true`, or `&&` by `\|\|` | equivalent | `refOf` answers `undefined` for an undefined record (`contexts/host-registration/domain/registration-record.ts:140-141`), so a defined ref implies defined registrations. With no ref, `withoutRef` filters nothing (same file, line 145) and stores a record equal to the one it replaces. |
| `remove-plugin.ts:287`, `code === "ENOENT"` replaced by `true` | equivalent | The same file was read first by `assertProjectMcpEntriesRemovable` (`remove-project-plugin.ts:36-43`), which rethrows every error that is not `ENOENT`. Only a file removed between the two reads reaches the catch with another code. |

## translate

| Survivor | Verdict | Proof |
| --- | --- | --- |
| `contexts/translate/domain/engine.ts:348`, skills branch condition replaced by `false`, and its `"skills"` literal replaced by `""` | equivalent | `markdownSection(kind)` is `capabilities[kind] ?? null` and `skillsSection()` is `capabilities.skills ?? null` (`contexts/tools/domain/profile/define-tool.ts:306-307`). Both branches read the same value, the condition is a spelling. |
| `contexts/translate/domain/engine.ts:393`, trailing `$` dropped from the command-prefix regex | limit | `.+` does not cross a newline, so the two regexes differ only for a command name holding one. No plugin manifest holds such a name. |
| `contexts/translate/infrastructure/schema-validator.ts:38`, `[]` replaced by a one-element array in `validateFn.errors ?? []` | limit, not covered | The right side of `??` never runs: ajv sets `errors` whenever the data is invalid, and the branch runs only then. The fallback is a type-level guard. |
| `contexts/translate/infrastructure/schema-validator.ts:39`, `"unknown error"` replaced by `""` in `e.message ?? "unknown error"` | limit, not covered | The right side of `??` never runs: ajv always sets `message` (`messages: false` is not configured). Same type-level guard. |

A limit is a case no real input reaches. If one does, the mutant stops being equivalent and a test replaces the limit.
