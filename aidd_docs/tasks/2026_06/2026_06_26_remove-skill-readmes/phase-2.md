---
status: done
---

# Instruction: Update Generation And Documentation Assumptions

Part of [`plan.md`](./plan.md).

## Architecture projection

```txt
plugins/aidd-context/skills/04-skill-generate/
  SKILL.md
  actions/
    01-capture-intent.md
    03-draft-skill.md
    05-validate.md
  references/
    skill-authoring.md
    tool-paths.md
  assets/
    skill-template.md

plugins/<plugin>/skills/<generated-skill>/
  README.md -> SKILL.md     # plugin-source mode only
  SKILL.md
  actions/
```

## Tasks to do

### `1)` Update skill-generation write behavior

> Make plugin-source skill generation create or preserve the symlink convention without writing substantive per-skill README prose.

1. Update `plugins/aidd-context/skills/04-skill-generate/actions/03-draft-skill.md` so plugin-source rendering writes `SKILL.md` and ensures `README.md -> SKILL.md`.
2. Keep host-project skill generation focused on the target tool's `SKILL.md`; do not require a README.
3. In modify mode, preserve a correct symlink, replace only a direct regular per-skill README in plugin-source mode, and avoid touching nested README templates.

### `2)` Update capture, authoring, and seed guidance

> Remove stale assumptions that a new skill needs dedicated README prose.

1. Update skill-generate capture/reference wording if it asks for or implies substantive per-skill README content.
2. Add seed guidance in `03-draft-skill.md` or the relevant reference so new plugin-source skills create `README.md` as a symlink to `SKILL.md` immediately after `SKILL.md` is written.
3. Keep asset README references in unrelated skills intact when they describe generated project docs or templates.

### `3)` Update plugin/docs references that describe per-skill READMEs as content surfaces

> Align documentation with `SKILL.md` as the canonical skill file.

1. Search `plugins/`, `scripts/`, `aidd_docs/`, and root docs for wording like `skill README`, `per-skill README`, or links that imply unique per-skill content.
2. Rewrite stale prose to reference `SKILL.md`, catalog entries, or the symlink convention.
3. Leave historical changelog entries unchanged unless they are part of generated current docs.

## Acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Plugin-source skill generation instructions explicitly ensure `README.md -> SKILL.md` and do not ask the user for README prose. |
| 1 | Host-project skill generation instructions do not create or require README files. |
| 2 | Creation guidance explicitly seeds the plugin-source skill README symlink before the action reports files written. |
| 2 | References to asset README templates remain intact where they are not direct skill landing pages. |
| 3 | Current docs no longer claim direct skill READMEs contain distinct per-skill documentation. |

## Validation commands

```sh
rg -n "skill README|per-skill README|substantive per-skill|skills/.*/README.md" plugins scripts aidd_docs README.md -g '!**/CHANGELOG.md'
rg -n "README" plugins/aidd-context/skills/04-skill-generate
pnpm exec lefthook run pre-commit --all-files --force
```

## Dependencies

- Phase 1 should be complete so docs/generator updates can refer to the actual symlink convention.

## Expected commit boundary

Commit after skill generation instructions and current docs consistently describe the symlink convention.
