---
name: 01-update
description: Update an installed AI-Driven Development framework and its plugins. Use when asked to upgrade AIDD, review an available release, or bring an installed framework up to date. Not for updating unrelated project dependencies.
argument-hint: release | project | global
---

# Update

## Rules

- Locate this plugin's bundled `hooks/session-start.cjs` and run it with Node and `--json` from the current project. Use its `inventory`, `releases` and plugin comparisons; do not reconstruct them from guessed paths or another tool's registry. Report unavailable sources explicitly. Never print credentials.
- Start with current-project installations. Offer user-scope installations separately, with known dependent projects. Preserve tool, scope and installation method. An AIDD-managed native registration belongs to its CLI update, not a second native update.
- Propose the reported stable release or the installation's current prerelease channel. Change channel only on explicit request. Show current and selected versions, release title, notes, repository comparison and affected installations. The repository comparison covers all changes between tags, not just installed plugins or loaded session content.
- For CLI-managed project plugins, obtain approval for the release and shared-source impact, then run `aidd framework update --release <tag> --yes`; add `--allow-shared` only after that approval. For CLI-managed global OpenCode/Kilo copies, obtain separate approval and run `aidd framework update --release <tag> --scope user --yes` without `--allow-shared`: their shared marketplace stays unchanged. Never use setup as an update. If the CLI is absent, restore it rather than treating its installation as native.
- For host-owned Claude, Codex and Copilot GitHub marketplaces, run the bundled `hooks/update-native.cjs` with `--tool`, `--scope project|user` and `--release` to obtain a preview. Show its `impact` and `updates`, including disabled plugins and shared projects. After approval, repeat the command with exactly the returned `--approve` value. Follow [native commands](references/native-commands.md); never edit host settings yourself or bypass a refused preview.
- Leave local directories, moving branches, ambiguous sources and unsupported scopes unchanged. An official release shown for local content is indicative. For other CLI-managed global plugins, `aidd plugin update --scope user` is valid only when the recorded source already points to the selected release.
- Re-run inspection after updating. Report updated, unchanged, unavailable or failed per tool and scope. Distinguish catalogue, CLI and installed plugin versions; request a new session to load changes. On partial failure, inspect the remaining state and obtain approval for a new preview before retrying. A successful catalogue refresh alone is not a verified plugin update.
