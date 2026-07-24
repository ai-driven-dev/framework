---
status: done
---

# Instruction: Derive SUPPORTED_TARGETS from the build registry

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── cli/src/
    ├── infrastructure/deps.ts        ✏️ modify (export SUPPORTED_BUILD_TARGETS)
    └── application/commands/
        └── framework.ts               ✏️ modify (import it, drop the hand-copied array)
```

## Tasks to do

### `1)` Export a derived target list from `deps.ts`

1. Right after `FRAMEWORK_BUILD_REGISTRY`'s declaration (`deps.ts:240-337`), add:
   ```ts
   export const SUPPORTED_BUILD_TARGETS: readonly FrameworkBuildTarget[] = [
     ...new Set(
       Object.keys(FRAMEWORK_BUILD_REGISTRY).map((key) => key.split(":")[0] as FrameworkBuildTarget)
     ),
   ];
   ```
   (`FrameworkBuildTarget` is already imported in `deps.ts` — confirm, add the import if not.)

### `2)` Use it in `framework.ts`

1. Delete the hand-copied `const SUPPORTED_TARGETS: readonly string[] = [...]` (`framework.ts:11`).
2. Import `SUPPORTED_BUILD_TARGETS` from `../../infrastructure/deps.js` instead.
3. Update the two usages (`framework.ts:39,41`) to the new name — behavior identical, just sourced from the registry.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1, 2 | `aidd framework build --target <unknown>` still fails with the same clear error message as before. |
| 1, 2 | `aidd framework build --target <known> [--flat]` still works for all 9 existing target:mode combinations, identical output to before. |
| all  | `tsc --noEmit` clean, existing framework-build tests (unit + e2e) pass with zero assertion changes. |
