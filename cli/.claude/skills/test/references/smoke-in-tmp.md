# Reference: Smoke / Dogfood Install Isolation

## Rule

Smoke and dogfood installs MUST run in a fresh `/tmp/<name>` directory, never in the repo root.

## Why the repo root is forbidden

Running a CLI install command in the repo root leaks tool-specific residue into the working tree:

- `.codex/` (OpenAI Codex)
- `.cursor/` (Cursor)
- `.github/copilot/` (GitHub Copilot)
- `.opencode/`, `opencode.json` (OpenCode)
- `.vscode/` (VS Code)

This project is Claude-only. Only `.claude/` and `.aidd/` are legitimate in-repo directories. Any other tool scaffold committed to the repo contaminates the tree and poisons other contributors' environments.

## Pattern

```sh
# 1. Build from current branch
pnpm build

# 2. Create and initialize a clean workspace
mkdir -p /tmp/smoke-<feature>
cd /tmp/smoke-<feature>
git init

# 3. Invoke the real binary
node /abs/path/to/repo/dist/cli.js <command> [flags]

# 4. Assert: exit code, stdout content, files written
echo "Exit: $?"
ls -la /tmp/smoke-<feature>

# 5. Cleanup
rm -rf /tmp/smoke-<feature>
```

## When an in-repo install is unavoidable

If a test fixture or CI job requires the install to run inside a subdirectory of the repo, add the generated directories to `.gitignore` before running the install. Do not commit them.

Example `.gitignore` entries to add:

```
.codex/
.cursor/
.opencode/
opencode.json
.vscode/
```

Only add entries for tools actually being installed. Remove the entries after the test if they are no longer needed.

## Scope

This rule applies to:

- Manual smoke runs during development
- Empirical reproduction transcripts (action 04)
- Any automated test that invokes the real CLI binary outside the standard `runCli()` helper

It does NOT apply to unit or integration tests that run entirely in memory or in stdlib temp dirs.
