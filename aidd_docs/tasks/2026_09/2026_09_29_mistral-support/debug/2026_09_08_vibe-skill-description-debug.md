# Task [vibe-skill-description-debug]

Symptom: Vibe launch fails to load `.vibe/skills/*/SKILL.md` with `SkillMetadata.description Field required`. Input dict is `user-invocable` + `name` only.

## Hypotheses

- [x] H1 `parseYamlLike` drops every CRLF frontmatter key because `.` does not match `\r`. VALIDATED: `plugins/**/SKILL.md` is 47/47 CRLF; `parseFrontmatter` on `03-assert` returns `{}`; roundtrip then matches disk (`user-invocable` + rewritten `name` only). Regex `/^(\w[\w-]*):\s*(.+)$/` is null on `name: 03-assert\r`, matches after `trimEnd()`.
- [x] H2 `convertMistralSkillFrontmatter` drops `description` by design. INVALIDATED: converter copies `description` when present; unit test keeps it. Empty parse is what starves it.
- [x] H3 `rewriteSkillNameFrontmatter` rebuilds frontmatter without `description`. INVALIDATED as cause: it spreads parsed keys then overwrites `name`. Description is already gone.
- [x] H4 Vibe `SkillMetadata` requires `description` and the built file lacks it. VALIDATED as the load failure, not the generator bug. Error: `Field required ... input_value={'user-invocable': True, ... name: aidd-dev-03-assert}`.
- [x] H5 Source skills have no `description`. INVALIDATED: `plugins/aidd-dev/skills/03-assert/SKILL.md` and `aidd-pm/skills/10-task/SKILL.md` both have it. Leftover `.vibe/.../skill/skill.md` still has it because the old mapper copied bytes without YAML parse.

## Root cause

`parseFrontmatter` / `parseYamlLike` in `cli/src/domain/formats/markdown.ts` treat CRLF values as non-keys (`RegExp` `.` skips `\r`). Mistral flat transform then emits only `user-invocable: true`; `rewriteSkillName` adds `name`. Vibe rejects the file.

## Next (done 2026-09-08)

`parseFrontmatter` splits on `\r?\n`. CRLF unit + mistral flat integration tests. Rebuild grw-mistral: 47/47 `SKILL.md` have `description`.
