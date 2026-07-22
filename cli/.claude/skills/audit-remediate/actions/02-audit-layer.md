# 02 - Audit Layer

Enumerate all violations in the target layer by applying the layer skill's transversal rules
and invariant checks to every file. Produces a named violation list; does not touch any file.

## Inputs

- `target-layer-path` (required) - directory to audit
- `layer-skill` (required) - the authoritative layer skill (read its transversal rules)

## Outputs

A violation list. Each entry:
- File path (relative to project root)
- Violation type (from the layer skill's transversal rules)
- Description of the violation
- Proposed fix approach (how the layer skill resolves it)

## Process

1. Read the layer skill's SKILL.md. Extract its transversal rules and invariant rules sections.
2. For each file in `target-layer-path`:
   a. Check each transversal rule against the file's content.
   b. Record any violation with its file path, rule violated, and fix approach.
3. Produce a numbered violation list. If the list is empty, record a confirmed-clean verdict:
   "02 complete — layer \<path\> audited clean by \<layer-skill\>. No violations found."
4. Do not edit any file in this action.

## Common check categories

Consult the layer skill for the definitive list. Typical checks by layer:

- `format`: named export only, no `any`, pure function (no I/O/side effects), lossless
  round-trip inverse present, `.js` ESM imports, `CONSTANT_CASE` for repeated literals.
- `capability`: `Has*` interface in the tool contracts file, constructor accepts single params object,
  all public fields `readonly`, throws `CapabilityConfigError` on invalid params, named export
  only, no `any`, `in` operator for presence guard, `.js` imports.
- `tool`: `AiTool<C>` type annotation, `signalDir` non-null and pointing to the correct dir,
  `rewriteContent`/`reverseRewriteContent` are lossless inverses, `registerTool` at file bottom,
  named export only, no `any`, `.js` imports.

## Test

The violation list is complete when every file in `target-layer-path` has been evaluated
against every transversal rule in the layer skill. Confirm file count matches `ls` output.
