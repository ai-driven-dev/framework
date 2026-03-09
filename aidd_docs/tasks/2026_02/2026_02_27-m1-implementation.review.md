# Code Review — M1 Domain Layer Implementation

**Date:** 2026-02-27
**Scope:** M1 tickets 010–016 (`src/domain/`, `tests/domain/`)
**Validation:** `pnpm typecheck` ✓ | `pnpm lint` ✓ | `pnpm test` ✓ (150/150)

---

## Summary

The M1 domain layer is functionally complete and all 150 tests pass. Three issues require attention: one confirmed bug in Copilot include rewriting, one silent-failure gap in manifest version validation, and one endsWith fragility in distribution filtering.

---

## Issues

### [BUG] Copilot `@{{TOOLS}}/` rewriting produces malformed markdown

**File:** `src/domain/tool-specs/copilot.ts:22–28`
**Severity:** High

`rewriteAtToolsInclude()` returns an unclosed markdown link prefix:

```ts
// Current — missing closing paren
protected rewriteAtToolsInclude(): string {
  return `[include](${this.directory}`;  // → "[include](.github/copilot/"
}
```

For input `@{{TOOLS}}/rules/naming.md`, output is `[include](.github/copilot/rules/naming.md` — the `)` is never added. Same defect in `rewriteAtDocsInclude()`.

No test covers the `@{{TOOLS}}/` path for Copilot because the fixtures contain no placeholder syntax. The bug is latent but will surface when real framework content uses `@` includes.

**Fix needed:** Redesign the replacement strategy. The replacement of `@{{TOOLS}}/path` cannot inject a closing `)` with a simple prefix swap — the entire `@{{TOOLS}}/path_until_whitespace` must be matched and replaced atomically, or the `rewriteContent()` base method must be overridden in `CopilotToolSpec` to apply a regex that wraps the full path.

---

### [BUG] `distribution.ts` entryFile check uses `endsWith` — fragile match

**File:** `src/domain/models/distribution.ts:22`
**Severity:** Medium

```ts
if (section.entryFile !== null && !relativeFileName.endsWith(section.entryFile)) {
  continue;
}
```

For `entryFile = "SKILL.md"`, any file ending in `SKILL.md` passes — including `ASKILL.md`. The correct check is basename equality:

```ts
const baseName = relativeFileName.split("/").at(-1) ?? relativeFileName;
if (section.entryFile !== null && baseName !== section.entryFile) {
  continue;
}
```

---

### [SILENT FAILURE] `Manifest.fromJSON()` ignores manifest version

**File:** `src/domain/models/manifest.ts:149–190`
**Severity:** Medium

`MANIFEST_VERSION = "1"` is defined but never used in deserialization. Loading a future incompatible manifest format silently succeeds. Violates "fail loudly" coding assertion.

```ts
// Missing in fromJSON():
if (raw.version !== MANIFEST_VERSION) {
  throw new Error(`Unsupported manifest version: ${String(raw.version)}.`);
}
```

---

### [QUALITY] No public API to add docs entries to `Manifest`

**File:** `src/domain/models/manifest.ts`
**Severity:** Medium

`_docs: DocsEntry | null` is only populated via `fromJSON()`. There is no `addDocs()` method. The `computeStatus()` includes docs files in drift detection, but the install flow has no way to write docs tracking. The `StatusReport` docs path through `computeStatus()` is untested.

This is likely deferred to ticket 031 (init use case) but the domain model exposes an incomplete contract: the field exists, it affects behavior, but it cannot be written.

---

### [QUALITY] `_docs` field is not `readonly` — inconsistent with `_tools`

**File:** `src/domain/models/manifest.ts:37`
**Severity:** Low

```ts
private readonly _tools: Map<ToolId, ToolEntry>;  // readonly
private _docs: DocsEntry | null;                   // NOT readonly
```

`_docs` is never reassigned after construction. Should be `readonly` to match `_tools` and prevent accidental mutation.

---

### [QUALITY] Missing unit tests for `frontmatter.ts`

**File:** `src/domain/models/frontmatter.ts`
**Severity:** Low

`parseFrontmatter` and `serializeFrontmatter` are tested only indirectly through distribution and tool-spec tests. Direct unit tests are missing for:

- Content with no frontmatter (no leading `---`)
- Malformed frontmatter (opening `---` without closing `---`)
- Empty frontmatter block (`---\n---\n`)
- Round-trip parity: `serializeFrontmatter(parseFrontmatter(x)) === x`
- Numeric scalar values (currently parsed as strings, not numbers)

---

### [QUALITY] `ToolId` enum co-located with `ToolSpec` abstract class

**File:** `src/domain/models/tool-spec.ts`
**Severity:** Low

`ToolId` is a standalone identifier enum but lives in `tool-spec.ts`. It is imported by `manifest.ts`, `tool-entry.ts`, and all three tool-spec implementations. As the codebase grows, this creates an import dependency on the abstract class file just to get the enum. Extract to `src/domain/models/tool-id.ts`.

---

## Passed Checks

- Domain layer zero infrastructure imports ✓
- Max 2 runtime dependencies (`commander`, `@inquirer/prompts`) ✓
- 4-layer architecture boundary respected ✓
- All value objects use `readonly` properties ✓
- All ports are TypeScript interfaces ✓
- `FileHash` validates 32-char lowercase hex on construction ✓
- `Manifest.removeTool()` throws on non-existent tool ✓
- `ConflictSet.applyResolutions()` throws as v3.1+ seam ✓
- All file/function/type names follow conventions ✓
- No duplication across model files ✓
