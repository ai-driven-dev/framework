# Write targets

Where a skill tree is written, per tool.

## Root

| Tool           | Root                             |
| -------------- | -------------------------------- |
| Claude Code    | `.claude/skills/<name>/`         |
| Cursor         | `.cursor/skills/<name>/`         |
| OpenCode       | `.opencode/skills/<name>/`       |
| GitHub Copilot | `.github/skills/<name>/`         |
| Codex CLI      | `.agents/skills/<name>/`         |
| Kilo native    | `.kilo/skills/<name>/`           |
| Kilo portable  | `.agents/skills/<name>/`         |
| Plugin source  | `plugins/<plugin>/skills/<name>/` |

## Placement and preservation

- Kilo defaults to the native proposal; require explicit user agreement before using `.agents/skills/`, even when Codex is also selected. Confirm one placement and never write both Kilo trees for the same skill.
- Deduplicate resolved destinations, including a portable target shared with Codex. Existing same-name copies across native, portable or other detected skill roots require a user resolution before any writing; do not delete or synchronize user copies implicitly.
- If Kilo native and another selected host would also publish this skill to the portable root, request a placement or target resolution before writing. Offer one explicitly agreed shared portable copy or a revised target selection; never create both trees to satisfy the unresolved choices.
- When selected hosts share a destination, use their common supported fields. If a requested field is incompatible with any selected host, request a target or field resolution before writing; never silently drop a requested field or let target order choose the renderer.
- Before creating any directory, inspect every target and planned file, all existing ancestors and local references. Reject unsafe names, paths escaping the workspace or chosen target, symlinks, non-regular files, non-writable destinations and unresolved name collisions. A missing destination requires a writable existing ancestor.
- For modify, read the current tree first. Preserve user edits and resources, including actions/assets absent from the change plan. Ask before replacing a conflicting file; refusal leaves all targets unchanged. A create over an existing skill requires resolution rather than implicit overwrite.
- Resolve every local Markdown link within the final skill tree before publication; references may point to planned files or retained regular files, never outside the skill. Preflight all selected targets before the first write; a known invalid final target refuses the whole run.
- An identical request with identical choices reuses the current content. Compare bytes before writing and retain mtime when unchanged. No multi-file crash or concurrent-write transaction is promised by this interpreted workflow.

## Frontmatter

Emit `description` always, `name` only where listed, drop the rest.

| Tool                   | Fields                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| Claude Code            | `name`, `description`, opt `allowed-tools`, `disable-model-invocation` |
| Cursor, GitHub Copilot | `name`, `description`, opt `allowed-tools`                             |
| OpenCode               | `description`, opt `permission` map                                   |
| Codex CLI              | `name`, `description` (strips the rest)                                |
| Kilo native or portable | `name`, `description`, opt `license`, `compatibility`, `metadata` |

For Kilo, `name` must equal the parent directory name, use lowercase letters, digits and single hyphens, and contain at most 64 characters. Require a nonempty description of at most 1024 characters. Emit optional fields only when requested; omit `argument-hint` and Claude-specific fields from Kilo outputs. Keep the canonical Claude template and authoring contract unchanged; render the selected host fields after filling the template. The host field table takes precedence over R4 for generated host outputs only.

Sources: [Kilo Agent Skills](https://kilo.ai/docs/customize/skills) and [Agent Skills format](https://agentskills.io/specification). Verified on 2026-09-25 by issue #914; reverified 2026-10-10. Native and portable locations are loader-compatible; compatibility does not authorize copying.
