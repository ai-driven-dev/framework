# Contributing

Guidelines for adding agents, commands, rules, and skills to your project.

## Creating New Content

Use the generate commands to create content that follows the framework structure:

| Command             | Creates     |
| ------------------- | ----------- |
| `/generate_agent`   | New agent   |
| `/generate_command` | New command |
| `/generate_rules`   | New rule    |
| `/generate_skill`   | New skill   |

These commands use the scaffolds in `aidd_docs/templates/aidd/` and output files in the correct location for your tool.

## Templates

All templates live in `aidd_docs/templates/` and can be modified to match your team's conventions. Changes are tracked via hashes in `.aidd/config.yml` — the CLI will warn before overwriting modified files on update.

### Framework scaffolds (`aidd/`)

Used by the generate commands to create new content:

| Template | File                                      |
| -------- | ----------------------------------------- |
| Agent    | `aidd_docs/templates/aidd/agent.md`   |
| Command  | `aidd_docs/templates/aidd/command.md` |
| Rule     | `aidd_docs/templates/aidd/rule.md`    |
| Skill    | `aidd_docs/templates/aidd/skill.md`   |

### Project templates (`dev/`, `pm/`, `vcs/`)

Used as reference documents by commands. You can adapt these to your project's conventions:

| Folder | Templates                                                                |
| ------ | ------------------------------------------------------------------------ |
| `dev/` | ADR, code review checklist, decision record, tech choice comparison      |
| `pm/`  | PRD, brief, user story, persona, JTBD, milestones, interview transcript  |
| `vcs/` | Commit message, pull request, branch naming, issue, release notes        |

## Syncing Across Tools

If your project uses multiple tools (e.g. Claude Code + Cursor), content created in one tool needs to be available in the other.

Options:

- **CLI update**: re-run the CLI install — it syncs content across all configured tools
- **Manual copy**: copy the file to the other tool's folder, adapting the syntax as described in the IDE mapping rule for each tool

## Recommended Workflow

We recommend creating a **pull request** for any new agent, command, rule, or skill. This gives your team visibility on changes that affect how the AI behaves in your project.

When modifying content, we recommend staying within 5-10% of the original template structure. If you need more deviation, consider updating the template first.
