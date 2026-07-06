---
objective: "Every per-skill README.md that mirrors its SKILL.md is gone, and no link, doc, or generator points at a removed file."
status: reviewed
---

# Plan: Remove per-skill README.md

## Overview

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| **Goal**   | Delete the 39 per-skill `README.md` mirrors; keep navigation intact.  |
| **Source** | GitHub issue #302 (ai-driven-dev/framework)                           |

## Phases

| #   | Phase                        | File                         |
| --- | ---------------------------- | ---------------------------- |
| 1   | Remove READMEs, fix all refs | [`phase-1.md`](./phase-1.md) |
| 2   | Verify and guard             | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                              | Verified                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GitHub issue #302                                   | Objective + QA acceptance criteria; symlink is optional and droppable.                      |
| `lefthook.yml`                                      | Pre-commit runs `check-markdown-links.js` (link gate), regenerates every `CATALOG.md`, and syncs `README.md` counts. |
| `scripts/summarize-markdown.js`                     | `CATALOG.md` is fully auto-generated from the file tree; deleted READMEs vanish on regen.   |
| `scripts/sync-readme-counts.mjs`                    | Counts skills by directory, README-independent; only touches the top-level `README.md`.     |
| `plugins/aidd-context/skills/04-skill-generate/*`   | Does not scaffold a per-skill README; removal is durable for future skills.                 |

## Decisions

| Decision                                            | Why                                                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Delete the READMEs, do not symlink to SKILL.md      | Plugin ships cross-OS (symlink fragile); a symlink would render SKILL.md's raw YAML frontmatter on GitHub; issue accepts clean removal. |
| Retarget plugin-README skill-table links to SKILL.md | Preserves folder navigation after the README is gone; these tables are hand-written, not generated.                          |
| Regenerate CATALOG.md, never hand-edit it           | `CATALOG.md` is auto-generated; hand edits are overwritten by the pre-commit hook.                                            |
