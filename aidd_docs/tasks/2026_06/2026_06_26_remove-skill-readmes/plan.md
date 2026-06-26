---
objective: "Remove substantive per-skill README files and standardize direct skill README.md entries as symlinks to their plugin-level README.md."
status: in-progress
---

# Plan: Remove Skill READMEs

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Direct skill directories keep `README.md` only as a symlink to the owning plugin README, and generators/catalogs/docs stop treating per-skill READMEs as substantive files. |
| **Source** | Inline SDLC request from 2026-06-26. |

## Scope

Target:

- Replace committed files matching direct skill README paths (`plugins/<plugin>/skills/<skill>/README.md`) with symlinks resolving to `plugins/<plugin>/README.md`.
- Update skill generation behavior so plugin-source skill creation creates or preserves the symlink convention without asking for or writing substantive per-skill README content.
- Update validation, cataloging, plugin READMEs, and docs that assume direct skill READMEs contain unique content.
- Validate with repository checks plus focused symlink assertions.

Hard constraints:

- Do not edit nested asset/template READMEs such as `plugins/*/skills/*/assets/README.md`; those are not direct per-skill README landing pages.
- Use a relative symlink target of `../../README.md` for every direct skill README so plugin directories remain relocatable.
- Keep generated catalogs deterministic and compatible with `pnpm exec lefthook run pre-commit`.
- Preserve plugin-level README files as the substantive documentation surface.

Non-goals:

- Do not remove or rewrite plugin-level `plugins/*/README.md` files except link/reference updates required by the symlink convention.
- Do not remove asset README templates used by skills to generate project docs.
- Do not change skill runtime semantics unrelated to README generation and discovery.

Done when:

- Every direct skill README in committed plugin skill directories is a symlink resolving to the owning plugin's README.
- No direct committed skill README remains a regular file.
- Skill generation no longer asks for or writes standalone per-skill README prose, and plugin-source generation creates or validates the symlink.
- Catalogs/docs/checks reflect the symlink convention and no stale per-skill README assumption remains.
- Repository validation and focused symlink checks pass.

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Convert Existing Skill READMEs | [`phase-1.md`](./phase-1.md) |
| 2 | Update Generation And Documentation Assumptions | [`phase-2.md`](./phase-2.md) |
| 3 | Validate Catalogs, Distribution, And Checks | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| --- | --- |
| `plugins/*/skills/*/README.md` direct filesystem scan | There are 37 direct skill README regular files to convert. |
| `plugins/*/skills/*/assets/**/README.md` scan | Nested asset/template READMEs exist and are outside the conversion scope. |
| `plugins/aidd-context/skills/04-skill-generate/**` | Skill generation writes `SKILL.md` and actions; plugin-source behavior needs explicit README symlink handling and docs. |
| `scripts/summarize-markdown.js` and `lefthook.yml` | Catalog generation currently scans symlink targets via `fs.statSync`; validation must account for symlink convention. |
| `.github/workflows/validate.yml` | CI runs `pnpm exec lefthook run pre-commit --all-files --force` after install. |

## Decisions

| Decision | Why |
| --- | --- |
| Use `../../README.md` as the symlink target for direct skill READMEs. | Every direct skill directory is two levels below the plugin root, and a relative target keeps plugin bundles relocatable. |
| Keep nested asset/template READMEs as regular files. | They are templates or documentation for generated assets, not per-skill landing pages. |
| Keep plugin README skill-table links pointing at `skills/<skill>/README.md` unless implementation discovers a tool incompatibility. | The path remains valid through the symlink while preserving existing public link shape. |
| Add focused validation beyond lefthook. | Existing hooks validate catalogs/frontmatter but do not prove direct skill README entries are symlinks to plugin READMEs. |

## Expected Commit Boundaries

| Commit | Contents |
| --- | --- |
| 1 | Convert existing direct skill README files to symlinks and update generated catalogs if needed. |
| 2 | Update skill generation instructions/templates and any stale docs or catalog assumptions. |
| 3 | Add/adjust validation for the symlink convention and refresh generated outputs after checks. |
