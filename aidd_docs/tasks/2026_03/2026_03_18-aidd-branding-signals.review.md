# Code Review: aidd-branding-signals branch vs main

Date: 2026-03-18
Reviewer: Martin (Code Checker Agent)
Branch: main (worktree: signals)
Scope: src/ + tests/ diff

## Summary Table

| Title | Files | Score |
|-------|-------|-------|
| opencode commands() uses inline handler instead of buildStandardCommandsHandler | src/domain/tools/opencode.ts | 1 |
| opencode buildFilePath logic duplicated from cursor.ts pattern | src/domain/tools/opencode.ts, cursor.ts | 1 |
| copilot.ts agentsHandler/commandsHandler frontmatter methods clone namedAgentsSectionHandler in shared.ts | src/domain/tools/copilot.ts, shared.ts | 1 |
| init signal detection only scans first-level .md files, misses nested subdirs | src/application/use-cases/init-use-case.ts | 1 |
| includeArgumentHint boolean flag is a leaky control-coupling abstraction in shared.ts | src/domain/tools/shared.ts | 1 |
| check-update logger.info -> logger.warn change not covered by architecture notes | src/application/check-update.ts | 0 |
| loadConfig() helper in config.ts is a plain async function instead of use-case class | src/application/commands/config.ts | 0 |
| printDiffEntries() helper in update.ts is a plain function — correct, not a use-case | src/application/commands/update.ts | 0 |
| tryReadFile() private in gitignore-use-case correctly replaces silent catch | src/application/use-cases/gitignore-use-case.ts | 0 |
| writeDistFile() private in update-use-case correctly removes inline duplication | src/application/use-cases/update-use-case.ts | 0 |
| init tests use real filesystem (buildDeps with temp dirs), not vi.fn() — correct | tests/application/use-cases/init-use-case.test.ts | 0 |
| cursor.ts rewriteContent adds new regex for commands path rewriting — untested | src/domain/tools/cursor.ts | 1 |
| Test names in cursor.test.ts / opencode.test.ts describe method behavior not user scenarios | tests/domain/tools/cursor.test.ts, opencode.test.ts | 1 |
| Domain layer purity maintained — shared.ts has no infra imports | src/domain/tools/shared.ts | 0 |

---

## Score > 0 Details

### 1. opencode commands() uses inline handler instead of buildStandardCommandsHandler

File: `src/domain/tools/opencode.ts` lines 105-131

`opencode.ts` defines `commands()` as a manual inline object with `buildFilePath`, `convertFrontmatter`, and `reverseConvertFrontmatter`. The `convertFrontmatter` and `reverseConvertFrontmatter` bodies are thin wrappers that simply call `convertCommandFrontmatter(fm, relativeFileName, false)` and `reverseConvertCommandFrontmatter(fm, false)`.

`cursor.ts` and `claude.ts` use `buildStandardCommandsHandler(buildFilePath)` which wires the same frontmatter methods but with `includeArgumentHint: true`. The only difference for opencode is `includeArgumentHint: false`.

The inline handler could be replaced with a variant of `buildStandardCommandsHandler` parameterized by `includeArgumentHint`, which is already the purpose of `convertCommandFrontmatter`'s third argument. Since opencode does not inline-call `buildStandardCommandsHandler`, the factory's value is partially negated.

Action: Either create a `buildCommandsHandler(buildFilePath, includeArgumentHint)` that takes both params and use it across all four tools, or accept the current inline form as a deliberate opt-out from the factory. The current form does not violate DRY in terms of logic (it delegates to shared helpers), but it breaks the structural consistency pattern established by claude/cursor.

### 2. opencode buildFilePath duplication with cursor.ts

File: `src/domain/tools/opencode.ts` lines 107-119, `src/domain/tools/cursor.ts` lines 54-65

jscpd reports a 12-line clone between `cursor.ts` [113-125] and `opencode.ts` [167-179] (the memoryBank blocks). The memoryBank pattern `{ outputPath, rewriteContent }` is repeated across all tools without extraction, which is pre-existing design, not introduced by this branch.

For the commands `buildFilePath`, `opencode.ts` strips the tool suffix first, then resolves the phase dir; `cursor.ts` does not strip the suffix (the source files already lack the tool suffix at that point in the pipeline). Both produce `.../commands/aidd/<phase>/<baseName>`. The logic is structurally similar but not identical due to the `stripToolSuffix` difference. A shared `buildAiddCommandsFilePath(directory, toolSuffix?)` factory could eliminate this near-duplication.

### 3. copilot.ts frontmatter methods clone namedAgentsSectionHandler

File: `src/domain/tools/copilot.ts` lines 92-97, `src/domain/tools/shared.ts` lines 40-46

jscpd flags the `convertFrontmatter` / `reverseConvertFrontmatter` pair in `copilot.ts:agentsHandler` as a clone of the same methods in `namedAgentsSectionHandler`. The copilot handler cannot reuse the factory because `buildFilePath` adds `.agent.md` extension and GITKEEP filtering. The frontmatter methods are identical.

Fix: extract the frontmatter portion as `namedAgentsFrontmatter` (an object spread, same pattern as `passthroughFrontmatter`), then use `...namedAgentsFrontmatter` in both `namedAgentsSectionHandler` and `copilot.ts:agentsHandler`.

Same applies to `copilot.ts:commandsHandler` lines 106-115 vs `shared.ts:buildStandardCommandsHandler` lines 108-119 — the frontmatter methods are structurally identical and could be spread.

### 4. init signal detection only scans one level of .md files, not recursive

File: `src/application/use-cases/init-use-case.ts` lines 68-79

`this.fs.listDirectory(dirPath)` is recursive (the adapter's `collectFiles` traverses subdirectories and returns relative paths). The `filePath.endsWith(".md")` filter is applied to these relative paths. This works correctly — a file at `.claude/commands/aidd/04/implement.md` returns `aidd/04/implement.md` from `listDirectory(".claude/commands")`, and it ends with `.md`.

However the scan reads every `.md` file under the signal dirs, including deeply nested content that is clearly not frontmatter (e.g. doc files). The regex `/^name:\s*['"]?aidd:/m` is safe against false positives, but reading all content to grep for one line is expensive for large installations.

More importantly: the signal dirs list includes `.github/prompts` but not `.cursor/rules`, `.claude/rules`, `.claude/agents`, `.opencode/rules`, etc. A large existing AIDD installation would be missed if commands are not present but rules/agents are. This may be intentional (the PR name is "signals" — detecting only the command name prefix as a signal). If so, it should be documented.

Score: 1 (minor) — potential false-negative for installations without commands, undocumented scoping decision.

### 5. includeArgumentHint is control-coupling in shared.ts

File: `src/domain/tools/shared.ts` lines 67-92

Both `convertCommandFrontmatter` and `reverseConvertCommandFrontmatter` accept `includeArgumentHint: boolean`. This is a control-coupling flag — the caller dictates internal behavior of the callee via a boolean. The clean-code rule says to prefer polymorphism or two named functions over boolean flags that change behavior.

In practice the difference is whether `argument-hint` is included in the output. This could be two explicit functions: `convertCommandFrontmatterWithHint` / `convertCommandFrontmatterNoHint`, or the field could always be included and callers that don't want it (opencode) omit it upstream. The current form works but adds cognitive overhead whenever reading the callsites.

Score: 1 (minor) — no bug, only structural clarity concern.

### 6. cursor.ts rewriteContent new regex is untested

File: `src/domain/tools/cursor.ts` line 37

```ts
.replace(/(@\.cursor\/commands\/)(\d+)[_-][^/]+\/([^\s]+)/g, "$1aidd/$2/$3")
```

This regex rewrites existing inline `@.cursor/commands/04_code/...` references to the new `@.cursor/commands/aidd/04/...` path layout. It runs on every content rewrite. There is no unit test for this specific regex in `tests/domain/tools/cursor.test.ts` — the existing tests cover `buildFilePath` and `convertFrontmatter`, not `rewriteContent`. A regression here would silently produce broken `@` references in installed files.

The distribution snapshot test (`tests/domain/models/distribution.test.ts`) indirectly validates the output path, but not this inline-reference rewrite.

Score: 1 (minor) — missing direct coverage for the regex transformation.

### 7. Test names describe method behavior, not user scenarios

Files: `tests/domain/tools/cursor.test.ts`, `tests/domain/tools/opencode.test.ts`

Examples:
- `it("prefixes name with aidd:<phase>: and strips extra fields")` — describes the implementation, not a user outcome
- `it("maps phase-prefixed path to aidd/<phase>/ subfolder")` — same
- `it("strips aidd:<phase>: prefix from name")` — same

Rule from `05-testing/5-testing.md`: "Test names describe user-visible scenarios, not method names." For domain tool unit tests this is a grey area (no direct user visible behavior), but the pattern should still prefer behavioral framing: "command installed for phase 04 is accessible under aidd/04 namespace" vs "maps phase-prefixed path to aidd/<phase>/ subfolder".

Score: 1 (minor) — low severity, naming convention issue only.

---

## What Is Done Well

- `shared.ts` creation is the right abstraction — `baseRewriteContent`, `baseReverseRewriteContent`, `namedAgentsSectionHandler`, `passthroughSkillsHandler`, `detectSectionKeyFromPrefixes` all eliminate real duplication across claude/cursor/opencode.
- `tryReadFile()` private method in `GitignoreUseCase` correctly replaces two silent try/catch blocks with a single intent-expressing helper.
- `writeDistFile()` private method in `UpdateUseCase` correctly DRYs a repeated 3-line pattern.
- `loadConfig()` in `config.ts` correctly eliminates the three-site repetition of `createDeps + manifestRepo.load + null check`.
- Signal detection logic change (directory existence -> frontmatter content scan) is the correct architectural direction: avoids false positives on non-AIDD tool configs.
- All 683 tests pass. Typecheck and lint clean.
- Domain layer has zero infrastructure imports — `shared.ts` imports only from `../models/`.
- `check-update` logger level change (info -> warn) is semantically correct per the Logger port spec: warn goes to stderr and is always shown; update notices should not be buried in stdout.
