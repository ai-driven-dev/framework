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

Use the host's official documentation for each requested native field, preserving its value type and including only approved fields.

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

- Preview shows the selected paths and options and writes nothing.
- Run the approved request again without `--plan` after writing the portable tree in each target.
- The script updates only requested frontmatter fields in existing project skill files and refuses changes to `name` or `description`.
- For a shared path, the selected hosts must request identical options, with absent options counting as empty.
- Treat the canonical plugin source according to its plugin format.
