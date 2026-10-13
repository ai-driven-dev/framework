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

### Shared rules

- Resolve every selected host's destination before writing, then deduplicate identical physical destinations so each is rendered and written once.
- When hosts share a destination, render only fields supported by all of them. If a user-requested field is unsupported by any selected host, or selected hosts require incompatible destinations, ask for an explicit target or field resolution; never let target order decide or silently discard a requested field.
- Existing same-name skills in any detected skill root require user resolution before writing. Do not delete, synchronize, or overwrite user copies implicitly.
- Before creating directories, inspect every target, planned file, existing ancestor, and local reference. Reject unsafe names, paths escaping the workspace or selected target, symlinks, non-regular files, non-writable destinations, and unresolved name collisions. A missing destination requires a writable existing ancestor.
- For modify, read the current tree first and preserve user edits and resources, including actions and assets absent from the change plan. Ask before replacing a conflicting file; refusal leaves all targets unchanged. Creating over an existing skill also requires explicit resolution.
- Resolve every local Markdown link within the final skill tree before publication. Links may point to planned files or retained regular files, never outside the skill. Preflight all selected targets before the first write; any known invalid target refuses the whole run.
- For identical requests with identical choices, reuse current content. Compare bytes before writing and retain mtime when unchanged. This interpreted workflow does not promise a multi-file crash or concurrent-write transaction.

### Kilo placement

- Kilo defaults to the native proposal at `.kilo/skills/<name>/`. Require explicit user agreement before using the portable `.agents/skills/<name>/` target, including when Codex is also selected. Confirm one placement and never write both Kilo trees for the same skill.
- If Kilo native and another selected host would both publish this skill to `.agents/skills/`, resolve placement before writing. Offer one explicitly agreed shared portable copy or a revised target selection; never create both trees to satisfy unresolved choices.

## Frontmatter

Emit `description` always, `name` only where listed, drop the rest.

| Tool                   | Fields                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| Claude Code            | `name`, `description`, opt `allowed-tools`, `disable-model-invocation` |
| Cursor, GitHub Copilot | `name`, `description`, opt `allowed-tools`                             |
| OpenCode               | `description`, opt `permission` map                                   |
| Codex CLI              | `name`, `description` (strips the rest)                                |
| Kilo native or portable | `name`, `description`, opt `license`, `compatibility`, `metadata` |

**Canonical-to-host rendering:** Author the canonical skill according to AIDD conventions, including R4. Generated host artifacts must follow their target host's field contract. Omit unsupported canonical-only fields; explicitly resolve unsupported user-requested fields before writing.

For Kilo, `name` must equal the parent directory name, use lowercase letters, digits and single hyphens, and contain at most 64 characters. Require a nonempty description of at most 1024 characters. Emit optional fields only when requested; omit `argument-hint` and Claude-specific fields from Kilo outputs.

Native and portable locations are loader-compatible; compatibility does not authorize copying.
