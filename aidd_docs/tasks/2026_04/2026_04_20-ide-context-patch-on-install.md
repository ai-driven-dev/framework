# Plan: feat(install): patch IDE-conditional files when IDE tool is installed

## Feature

- **Summary**: When an IDE tool is installed alongside already-installed AI tools, automatically distribute the IDE-conditional config files for those AI tools (e.g. `copilot-settings.json` when vscode is added). No full reinstall — only the IDE-conditional slice is written. User files are never deleted.
- **Stack**: `TypeScript 5.x`, `Node.js >= 24`, `vitest`
- **Branch name**: `feat/ide-context-patch-on-install`
- **Parent Plan**: none
- **Sequence**: single part
- Confidence: 9/10

## Problem

`installOneTool` skips already-installed tools (`manifest.hasTool && !force → skip`).
`ideContext` is correctly computed (new + manifest IDE tools), but AI tools never re-run,
so IDE-conditional files (e.g. `copilot-settings.json` gated on `requiredIdeId: "vscode"`)
are never distributed when an IDE tool is added after the AI tool.

`aidd update` already handles this naturally (re-runs all tools with current ideContext) —
but the user should not be forced to run a second command after `aidd install vscode`.

## Scope

Only files with `requiredIdeId !== undefined` in `ConfigRef` are touched — today that is
`copilot-settings.json` (vscode). Everything else is untouched.

No `removeStaleFiles`. No full reinstall. Append-only on the manifest.

## Files

### Modified

| File | Change |
|------|--------|
| `src/domain/models/config-ref-filter.ts` | Add `extractIdeConditionalFiles()` |
| `src/application/use-cases/install-use-case.ts` | Call `IdePatchUseCase` after install loop |

### Created

| File | Change |
|------|--------|
| `src/application/use-cases/shared/ide-patch-use-case.ts` | New shared use case |
| `tests/domain/models/config-ref-filter.unit.test.ts` | Unit tests for both filter functions |
| `tests/application/use-cases/shared/ide-patch-use-case.integration.test.ts` | Integration tests |
| _(extend)_ `tests/application/use-cases/install-use-case.integration.test.ts` | End-to-end scenario |

## Implementation

### Phase 1 — `config-ref-filter.ts`

Add `extractIdeConditionalFiles()` alongside `filterGeneratedFilesByIdeContext()`:

```typescript
export function extractIdeConditionalFiles(
  generated: readonly GeneratedFile[],
  configRefs: readonly ConfigRef[],
  forIdeIds: readonly IdeToolId[]
): GeneratedFile[] {
  const requiredIdeByPath = new Map<string, IdeToolId>();
  for (const ref of configRefs) {
    if (ref.requiredIdeId !== undefined) {
      requiredIdeByPath.set(ref.path, ref.requiredIdeId);
    }
  }
  return generated.filter((file) => {
    const requiredIde = requiredIdeByPath.get(file.frameworkPath ?? "");
    return requiredIde !== undefined && (forIdeIds as string[]).includes(requiredIde);
  });
}
```

Symmetric inverse of `filterGeneratedFilesByIdeContext`:
- that function keeps files where `requiredIde` is in context (or absent)
- this function keeps only files where `requiredIde` matches one of `forIdeIds`

### Phase 2 — `IdePatchUseCase` (new shared use case)

File: `src/application/use-cases/shared/ide-patch-use-case.ts`

**Single responsibility**: distribute IDE-conditional files for already-installed AI tools when a new IDE is added.

Constructor injection order: `FileSystem → Hasher → Platform`

```typescript
interface IdePatchOptions {
  newIdeIds: IdeToolId[];
  installingIds: ToolId[];
  manifest: Manifest;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  docsDir: string;
  projectRoot: string;
}
```

**`execute()`** — finds AI tools to patch (≤ 20 lines):
- filter `manifest.getInstalledToolIds()` to `AI_TOOL_IDS` excluding `installingIds`
- for each: call `patchOneTool()`

**`patchOneTool()`** — generate → filter → write → update manifest (≤ 20 lines):
- `generateDistribution(descriptor, config, docsDir, contentFiles, hasher, platform, projectRoot, fs)`
- `extractIdeConditionalFiles(generated, descriptor.configRefs, newIdeIds)` — IDE slice only
- early return if slice is empty
- `writeIdeFiles(ideFiles, projectRoot, manifest)`
- `appendMergeEntries(toolId, ideFiles, config.config(), descriptor.configRefs, manifest)`

**`writeIdeFiles()`** — owned by this use case, not shared (≤ 20 lines):
- merge files (`mergeStrategy !== "none"`) → `fs.mergeJsonFile(outputPath, content, strategy)`
- regular files → guard `fs.fileExists && !manifest.isFileTracked` → skip or `fs.writeFile`

**`appendMergeEntries()`** — append-only to existing manifest entries (≤ 20 lines):
- build new `MergeFileEntry[]` via `buildMergeFileEntries()`
- get existing via `manifest.getMergeFiles(toolId)`
- filter to paths not already tracked
- call `manifest.updateToolMergeFiles(toolId, [...existing, ...toAdd])`

Why append and not replace: `updateToolMergeFiles` replaces all merge files for the tool —
replacing would erase already-tracked MCP entries.

### Phase 3 — `install-use-case.ts`

In `installAllTools`, after the for loop, add 4 lines:

```typescript
const newIdeIds = toolIds.filter((id): id is IdeToolId =>
  (IDE_TOOL_IDS as readonly string[]).includes(id)
);
if (newIdeIds.length > 0) {
  await new IdePatchUseCase(this.fs, this.hasher, this.platform).execute({
    newIdeIds, installingIds: toolIds, manifest, descriptor, contentFiles, docsDir, projectRoot,
  });
}
```

No new private methods in `install-use-case`.

### Phase 3 — Tests

#### Unit — `config-ref-filter.unit.test.ts` (new file)

| Test | Assert |
|------|--------|
| `filterGeneratedFilesByIdeContext` — no IDE context | IDE-conditional file excluded |
| `filterGeneratedFilesByIdeContext` — matching IDE in context | IDE-conditional file included |
| `filterGeneratedFilesByIdeContext` — non-conditional files always pass | both included regardless |
| `extractIdeConditionalFiles` — empty forIdeIds | returns empty |
| `extractIdeConditionalFiles` — matching IDE | returns only the conditional file |
| `extractIdeConditionalFiles` — non-conditional files excluded | returns empty |

#### Integration — extend `install-use-case.integration.test.ts`

```
describe("IDE context patch", () => {
  it("distributes copilot IDE-conditional files when vscode is installed after copilot", async () => {
    // 1. install copilot only → copilot-settings.json must NOT exist (no vscode yet)
    // 2. install vscode → copilot-settings.json must NOW exist
    // 3. manifest must track the new merge entry under copilot
    // 4. copilot's existing MCP merge entries must still be present (no data loss)
  })
})
```

## Invariants

- `writeToolFiles` already guards user file conflicts for non-merge files (`detectUserFileConflict`)
- merge files go through `mergeJsonFile` — safe for both `framework-prime` and `user-prime`
- `removeStaleFiles` is never called in the patch path → no file deleted
- `appendMergeEntries` skips already-tracked paths → idempotent if run twice

## Validation

1. `aidd install copilot` → `.vscode/settings.json` absent (no vscode)
2. `aidd install vscode` → `.vscode/settings.json` present AND `copilot-settings.json` keys written into it
3. manifest: copilot entry has MCP merge files intact + new `copilot-settings.json` merge entry
4. Run same sequence in reverse (`aidd install vscode copilot` in one command) → same result (no patch needed, both installed together)
5. `pnpm test` — all tiers pass
