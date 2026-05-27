# Tool resolution

Shared procedure. Every entry action calls this gate before writing any artifact.

## 1. Detect

Scan the project root for the following signals (D1 set):

| Signal                              | Indicates    |
| ----------------------------------- | ------------ |
| `.claude/` directory                | Claude Code  |
| `CLAUDE.md` file                    | Claude Code  |
| `.cursor/` directory                | Cursor       |
| `.opencode/` directory              | OpenCode     |
| `.codex/` directory                 | Codex CLI    |
| `AGENTS.md` file                    | Cursor / OpenCode / Codex CLI (no single tool implied; list all) |
| `.github/copilot-instructions.md`   | GitHub Copilot |

A signal does not guarantee exclusive use. Multiple signals from different tools are valid (e.g. `.claude/` + `.cursor/` = two confirmed tools).

## 2. Propose and confirm

Present the detected set to the user:

- List each detected tool by name.
- Ask which tools to target. Multi-select is allowed (1..N).
- Wait for explicit confirmation before proceeding.

In `mode = auto`, skip the prompt: the detected set becomes the confirmed set automatically. The gate still runs; only the user-confirmation step is omitted.

No-signal fallback: if no detection signal is found (fresh repo with no AI tool installed), propose all five tools cold:

- Claude Code
- Cursor
- OpenCode
- GitHub Copilot
- Codex CLI

Never default silently to Claude Code. Never guess.

## 3. Per-(artifact, tool) lookup and D2 block

For each combination of (artifact type, confirmed tool):

1. Look up `references/ai-mapping.md` to resolve the target path and format.
2. If the cell is marked **unsupported**, block that tool with an explanation (D2): state why the artifact has no equivalent for that tool and what to do instead.
3. Continue with the remaining supported tools. Never skip silently.

Example D2 block output:

> "Plugin scaffold for OpenCode is not supported: OpenCode has no plugin manifest and no slot tree. A plugin is a single JS/TS module. Place skills or agents directly under `.opencode/`, or publish an npm package."

## 4. Render: path and format

Resolving a target is not path alone. Format divergence is also part of the resolution.

### Field-level divergence

Handled by the per-surface frontmatter reconciliation table in `references/ai-mapping.md`. The single canonical template plus that table covers all field-level differences.

### Structural conversion cases

Two artifacts require a full structural conversion, not just field drops:

- **Codex agents (TOML)**: frontmatter fields become top-level TOML keys; the markdown body becomes the value of `developer_instructions`.
- **OpenCode hooks (JS module)**: the artifact is a JS/TS file exporting a hooks object, not a JSON descriptor.

The conversion logic for these cases lives in the **write action**, driven by `ai-mapping.md`. The reconciliation table does not cover structural conversion.

## 5. Generate-only gate

This procedure applies only when **generating** a new artifact.

**Modify mode exception**: when modifying an existing artifact, the target tool is already fixed by the artifact's on-disk location. Skip detect, propose, confirm, and D2. Proceed directly to editing the existing file.

## 6. Multi-tool rendering contract

Build **one canonical artifact** from the user's intent. Render it **once per confirmed tool** (N renders of one intent, not N separate authoring runs).

- The canonical artifact captures the intent: content, behavior, and tool-neutral field values.
- Each render applies the tool's path, extension, field reconciliation, and structural conversion as needed.
- All N renders are produced before the write action exits.

---

## Path conventions

Path conventions inside skill content (SKILL.md, action.md, reference.md):

- Use relative paths from the file's location, with the `@` prefix: `@../assets/X` from an action file at depth 1 under the skill, `@../../assets/X` from depth 2, `@assets/X` from SKILL.md or reference files at the skill root.
- The Agent Skills spec at agentskills.io mandates "use relative paths from the skill root" - this aligns.
- The plugin install directory variable (see `references/hook.md` "Path placeholders in handlers") is reserved for content the framework GENERATES into the user's workspace (hook config under `.claude/settings.json`, MCP server configs, plugin manifests, marketplace catalogs). The host runtime substitutes the variable at process-spawn time only in those surfaces.

---

## Shared gates (call these from entry actions, do not inline)

### Asset access precheck

Read `@references/ai-mapping.md` AND `@references/tool-resolution.md` (relative to the skill root). If either read fails or returns empty content, FAIL with:

```
status: blocked_assets_unreachable: cannot read skill references. The aidd-context plugin is not properly installed in this AI host's runtime. Install it as a plugin (or ensure the plugin root resolves to the install directory) before running this action.
```

Do not proceed. Do not invent a tool list. Do not guess paths.

### Target scope selection

Ask the user: "Write artifacts at the project root, or inside an existing/new plugin?"

- `project root` (default) -- set `target_base = ""` (empty string). All write paths are CWD-relative literals, landing under the user's workspace root (the host must set CWD = workspace).
- `plugin:<plugin-name>` -- set `target_base = "plugins/<plugin-name>/"`. Confirm the plugin dir exists or create it. All write paths are prepended with `target_base`.

This step is blocking. If no answer is received, FAIL with `status: blocked_awaiting_target_scope`.

### Write target validation

After writing, verify that every file in `files_written` satisfies all of the following:

1. The path is relative (no leading `/`), so it lives under the host's CWD (workspace root).
2. The path does not reference the plugin install directory (writing into the plugin install directory is not allowed; the path must not start with or contain the plugin root prefix).
3. If `target_scope = project root`: the path does not start with `plugins/<anything>/` (prevents accidental plugin writes).
4. If `target_scope = plugin:<plugin-name>`: the path starts with `plugins/<plugin-name>/`.

If any path violates any invariant, FAIL with `status: bad_write_target: wrote to <actual-path>, expected under <target_base>`.
