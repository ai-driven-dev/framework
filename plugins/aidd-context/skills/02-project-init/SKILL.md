---
name: 02-project-init
description: Initialize or refresh the project memory bank and ensure AI context files contain the project memory block. Use when running `aidd init` for the first time, bootstrapping a new project, or re-running the init flow on an existing project. Do NOT use for updating individual memory files after they exist - use `aidd-context:05-learn` instead; do NOT use for editing a single rule - edit the file directly.
model: opus
---

# Project Init

Bootstraps the AIDD context layer for a project: AI context files with memory block, `aidd_docs/` documentation structure, and the memory bank files. Rule directories are created lazily by `aidd-context:03-context-generate` when the first rule is written; project-init does not pre-scaffold them.

## Prerequisites

- This skill requires read access to its own `assets/` directory via `@<relative-path>` resolution. AI hosts that cannot resolve `@` paths to actual files on disk cannot run this skill. The actions self-check asset reachability at their first step and FAIL with `status: blocked_assets_unreachable` if access is denied.

## Available actions

| #   | Action                | Role                                                              | Input                       |
| --- | --------------------- | ----------------------------------------------------------------- | --------------------------- |
| 01  | `init-context-file`   | Ensure AI context files contain the `<aidd_project_memory>` block | project root                |
| 02  | `scaffold-docs`       | Create `aidd_docs/` structure with README and GUIDELINES          | project root                |
| 03  | `generate-memory`     | Detect project type and generate memory files in parallel         | `aidd_docs/memory/` from 02 |
| 04  | `review-memory`       | Cross-file consistency review of all generated memory files       | `aidd_docs/memory/` from 03 |
| 05  | `sync-memory`         | Execute `update_memory.js` to fill `<aidd_project_memory>` blocks | context files from 01       |

## Tool detection (run first)

The context files this skill writes are tool-specific. Detect, propose, and confirm the target tools ONCE at flow entry; the confirmed set drives action 01 (write context files) and, downstream, action 05 (sync the memory block into them). The memory steps (02, 03, 04) are tool-agnostic and do not depend on this gate.

1. **Detect.** Check the canonical context-file paths listed in `@references/mapping-ai-context-file.md` (one row per tool) at the project root. Only those paths qualify; any other file (`*.agent.md`, `<vendor>-*.md`, and lookalikes) is user project content, off-limits.
2. **Modify-mode shortcut.** If every detected context file already contains the `<aidd_project_memory>` block, this is a re-run on an initialized project: the confirmed set = the tools already present. Skip the prompt.
3. **Propose and confirm.** Otherwise present the detected files plus the tool list from `@references/mapping-ai-context-file.md` and ask which tools the user actively uses. Blocking: await an explicit pick; if none is received, FAIL with `status: blocked_awaiting_user_tool_selection`.
   - Default proposal: the tools whose context file is already present (propose, do not silently apply).
   - MUST NOT default to creating all three canonical files to "cover bases".
   - MUST NOT infer tools from filenames or repo signals.
   - In a non-interactive / auto run: the detected set becomes the confirmed set; if nothing is detected, use the explicit `aidd init` target, else `claude` alone. Never silently fan out to all three.

Output of the gate: `confirmed_tools`. Actions consume this set; they do not re-derive it.

## Default flow

Run the **Tool detection** gate first, then `01 → 02 → 03 → 04 → 05`. Run each action's `## Test` before moving to the next.

## Transversal rules

- AI context files are EXCLUSIVELY the three canonical paths white-listed in the Tool detection gate. Any other file (including agent/skill/vendor files with similar naming) is user project content and is OFF-LIMITS for this skill.
- Blocking on user input: if a step asks a question, await an explicit answer; never invent or stub.
- Templates structure the output; project facts come from the codebase scan. Never invent facts the repo does not contain. ALSO never pre-filter content as "not AIDD-relevant" - every file in the repo counts as project content, with the exception listed below.
- Memory files document the USER'S project. AIDD's own scaffold (`aidd_docs/`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.aidd/`) is framework metadata, never project content, and MUST NOT appear in memory files as if it were architecture or features of the project.
- For ambiguous directories or files (anything that looks like tooling, IDE metadata, vendor cache, recording state, etc., not clearly project content), ASK the user before including OR excluding. No silent decision either way. Do not enumerate vendor folders in this rule - the principle holds for any unknown tool footprint.
- Write files, do not display their content.
- Drop unused sections; empty placeholders are not preserved.
- Memory templates land at the root of `aidd_docs/memory/`. `aidd_docs/memory/internal/` is reserved for AIDD workflow traces (project-init audit notes, learn captures).
- Bullets stay short. Code in backticks. No version numbers in tech names (`React`, not `React 19`).
- Reflect current state only.
- Output names and paths are derived from the framework's templates/mapping references, never invented. One output file per matching template; no consolidation; no inside-subdirectory placement unless the mapping explicitly says so.

### Schema rules to apply to generated Mermaid diagrams

When this skill emits Mermaid diagrams, follow the project's Mermaid conventions.

## Assets

- `@assets/AGENTS.md` - canonical AI context file template
- `@assets/README.md` - `aidd_docs/README.md` template
- `@assets/GUIDELINES.md` - `aidd_docs/GUIDELINES.md` template
- `@assets/templates/memory/` - memory file templates (scope: `all` | `frontend` | `backend`)

## References

- `@references/mapping-ai-context-file.md` - mapping of AI context files across tools

## External data

- `../../hooks/update_memory.js` - syncs `<aidd_project_memory>` block content across all context files
