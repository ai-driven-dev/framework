# Write targets

Where a skill tree is written, per host.

## Targets

| Host | Root | Official source |
| --- | --- | --- |
| Claude Code / `claude` | `.claude/skills/<name>/` | [Skills](https://code.claude.com/docs/en/skills) |
| Cursor / `cursor` | `.cursor/skills/<name>/` | [Skills](https://cursor.com/docs/skills) |
| OpenCode / `opencode` | `.opencode/skills/<name>/` | [Skills](https://opencode.ai/docs/skills) |
| GitHub Copilot / `copilot` | `.github/skills/<name>/` | [CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#skill-frontmatter-fields), [VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| Codex / `codex` | `.agents/skills/<name>/` | [Skills](https://learn.chatgpt.com/docs/build-skills) |
| Kilo Code / `kilo` | `.kilo/skills/<name>/` | [Skills](https://kilo.ai/docs/customize/skills) |
| Antigravity / `antigravity` | `.agents/skills/<name>/` | [Skills](https://antigravity.google/docs/skills) |
| Kiro / `kiro` | `.kiro/skills/<name>/` | [Skills](https://kiro.dev/docs/skills/) |
| Kimi Code CLI / `kimi` | `.agents/skills/<name>/` | [Skills](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html) |
| Plugin source | where the target host's plugin format puts skills | the target host's plugin docs |

## Frontmatter

Emit `name` and `description`, the two fields of the [Agent Skills](https://agentskills.io/specification) standard every host reads.

Read the target's official documentation for requested native fields and pass the documented keys and types as JSON. Ask only when a required choice is missing.

For project targets, pipe JSON containing `name`, the selected host IDs in `targets`, and `nativeOptions` keyed by host ID to the scaffold script.

```json
{
  "name": "deploy",
  "targets": ["claude", "kilo"],
  "nativeOptions": { "claude": { "disable-model-invocation": true } }
}
```

```sh
node "$scaffold" --native - "$project_root" --plan
node "$scaffold" --native - "$project_root"
```

`$scaffold` is the absolute path to `scripts/scaffold-skill.cjs` in this skill and `$project_root` is the project directory.

- The script updates only requested frontmatter fields in existing project skill files and refuses changes to `name` or `description`.
- For a shared path, the selected hosts must request identical options, with absent options counting as empty.
- Treat the canonical plugin source according to its plugin format.

## Plan and apply

Use the confirmed targets. For an existing skill, locate the roots that already hold it.

With requested native options, run the preview and include its paths and options in the plan. On refusal, report the writer's reason and resolve it before writing.

After approval, rerun that preview before writing. If any `SKILL.md` or action file is missing, pipe the portable plan to `node "$scaffold" - "$skill_folder"`. Fill the files per [skill-tree.md](skill-tree.md) and [skill-authoring.md](skill-authoring.md).

Copy the portable tree to each distinct target root, keeping existing target-specific frontmatter. Once the selected project targets have their `SKILL.md`, pass the approved native request again without `--plan`.
