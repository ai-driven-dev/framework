# Write targets

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

## Write

Use the confirmed targets or the roots that already hold the skill. Use `name` and `description` for portable frontmatter.

For native options on project targets, read the official docs and pipe `{"name":"deploy","targets":["claude"],"nativeOptions":{"claude":{"disable-model-invocation":true}}}` to `node "$scaffold" --native - "$project_root" --plan`. Use the skill's `scripts/scaffold-skill.cjs` and the absolute project path. Include the preview in the plan and resolve any refusal before writing.

After approval, repeat any native preview. Scaffold missing files with the portable plan on stdin via `node "$scaffold" - "$skill_folder"`, and fill them per `skill-tree.md` and `skill-authoring.md`.

Copy the portable tree to each distinct root and keep existing target-specific fields. Apply the approved native request without `--plan` once the destination files exist.
