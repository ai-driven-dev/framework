# Project Brief

## Executive Summary

- **Package**: `@ai-driven-dev/cli` v3.0.0
- **Vision**: Distribute a canonical AI-Driven Development framework consistently across multiple AI coding assistants, eliminating manual tool-specific adaptation
- **Mission**: CLI that resolves the AIDD framework from remote/local sources, generates tool-specific file distributions with content rewriting and frontmatter conversion, and tracks every generated file in a hash-based manifest

### Description

- Community product gated by GitHub authentication token
- CLI is the distribution backbone — not a generic scaffolding tool
- Framework assets: agents, commands, rules, skills, templates
- Supported tools: Claude Code, Cursor, GitHub Copilot

## Core Domain

- Framework resolved from remote (GitHub Releases) or local path/tarball
- Files are rewritten per tool conventions (path, frontmatter, content format)
- Every installed file tracked in `.aidd/manifest.json` via MD5 hash
- Drift = local modification vs. what was written at install time

## Ubiquitous Language

| Term | Definition |
| --- | --- |
| Framework | Canonical set of agents, commands, rules, skills, templates |
| Distribution | Tool-specific generated output (files rewritten per tool conventions) |
| Manifest | `.aidd/manifest.json` — hash-based tracking of every installed file |
| ToolConfig | Per-tool configuration: output paths, frontmatter conversion, merge rules |
| Framework Descriptor | `framework.json` — describes the canonical framework's file layout |
| Drift | Installed file modified locally vs. what was written at install time |
| Init | Bootstrap: creates `aidd_docs/` structure + manifest |
| Install | Generates and writes tool-specific distribution files |

## Features & Use-cases

### v3.0 — SHIPPED (tickets 001-054)

- `aidd init` — create `aidd_docs/` structure and manifest
- `aidd install <tools...>` — generate tool-specific distributions (`--all`, `--force`)
- `aidd uninstall <tools...>` — remove tool files cleanly
- `aidd status [--tool]` — detect drift per tool
- `aidd clean [--force]` — remove all AIDD traces (dry-run by default)
- `aidd doctor` — diagnostics and health check (exit 1 on any issue)
- Global: `--verbose`, `--token`, `--repo`, `--framework` (dir or tarball)
- Auto-init when `install` run without prior `init`
- Manifest migration system for schema evolution

### v3.1 — DONE (tickets 060-064, 070-072)

- `--release <tag>` global flag — install/init a specific framework version (ticket 055, DONE)
- `aidd status` — update-available check: displays "Update available" when newer version exists (ticket 056, DONE)
- `aidd update` — download latest framework, apply diff per tool (tickets 060-061, DONE)
- `aidd update --dry-run` — preview changes without writing files (ticket 064, DONE)
- `aidd restore` — restore modified/deleted files from pinned version (tickets 062-063, DONE)
- `aidd sync` — cross-tool propagation of local changes (tickets 071-072, DONE)
- Conflict handling for update/restore with user-modified files (ticket 061, DONE)

### v3.2 — DONE (tickets 080-083)

- `aidd cache` — list and clear cached framework versions (ticket 080, DONE)
- `aidd config get/set/list` — manage `.aidd/settings.json` via CLI (ticket 081, DONE)
- `aidd init --force` — re-copy docs templates without full clean+reinit (ticket 082, DONE)
- `aidd doctor --fix` — auto-remediate detectable issues (ticket 083, DONE)

### v3.3 — Planned (ticket 085)

- `aidd adopt` — migrate a manually-installed framework to CLI-managed state (ticket 085, TODO)
  - Auto-detects installed tools (`.claude/`, `.cursor/`, `.github/`) without manifest
  - Downloads the latest framework version (or `--release` if specified)
  - Applies framework format to existing files — same conflict handling as `aidd update`
  - Files on disk not in framework → warning (doctor-style), not touched
  - `aidd init` on a project with existing AIDD files → blocks with message pointing to `aidd adopt`
  - Creates manifest with post-write hashes

### vNext — Vision (unspecified)

**Interactive / non-interactive mode:**

- No flag = interactive mode: step-by-step guidance via `@inquirer/prompts` (tool selection, confirmation, sub-part selection)
- With flags = non-interactive mode: current behavior, CI/scripting compatible
- Each command (`init`, `install`, `update`, ...) will have its interactive version

**Installation granularity (to be specified):**

- Direction: ability to install sub-parts of the framework independently
- Considered examples: thematic profiles (`common`, `dev`, `pm`, `ops`), privacy configs, technical files — exact scope not yet settled
- Requires dedicated thinking before spec: what is a "sub-part"? by role? by content type? both?
- Impacts `FrameworkDescriptor` and the manifest — do not implement before the vision is stabilized

## User Journey

### Multi-Tool Developer

```mermaid
journey
    section Install
      Run aidd install claude cursor: 5: Multi-Tool Dev
      Files generated in .claude/ and .cursor/: 5: CLI
    section Drift
      Modify some files locally: 3: Multi-Tool Dev
      Run aidd status: 5: Multi-Tool Dev
      Drift detected per tool: 5: CLI
    section Restore (v3.1+)
      Run aidd restore claude --force: 4: Multi-Tool Dev
      Files reverted to framework version: 5: CLI
```
