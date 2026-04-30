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

These commands use the scaffolds bundled inside each skill's `assets/` folder.

## Templates

Templates are co-located with their skill under `plugins/<plugin>/skills/<skill>/assets/`. Changes are tracked via hashes in `.aidd/config.yml` — the CLI will warn before overwriting modified files on update.

### Framework scaffolds

Used by the generate commands to create new content:

| Template | File                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| Agent    | `plugins/aidd-context/skills/03-context-generate/assets/agents/agent-template.md`  |
| Rule     | `plugins/aidd-context/skills/03-context-generate/assets/rules/rule-template.md`    |
| Skill    | `plugins/aidd-context/skills/03-context-generate/assets/skills/skill-template.md`  |

### Project templates

Used as reference documents by skill actions. You can adapt these to your project's conventions:

| Skill | Templates                                                                |
| ----- | ------------------------------------------------------------------------ |
| `07-learn`  | ADR, decision record                                          |
| `01-plan`   | Plan, master plan, tech choice comparison                     |
| `04-review` | Code review checklist, review, functional review              |
| `03-prd`    | PRD, task                                                     |
| `aidd-vcs`  | Commit message, pull request, branch naming, issue, release   |

## Syncing Across Tools

If your project uses multiple tools (e.g. Claude Code + Cursor), content created in one tool needs to be available in the other.

Options:

- **Manual copy**: copy the file to the other tool's folder, adapting the syntax as described in the IDE mapping rule for each tool

## Recommended Workflow

We recommend creating a **pull request** for any new agent, command, rule, or skill. This gives your team visibility on changes that affect how the AI behaves in your project.

When modifying content, we recommend staying within 5-10% of the original template structure. If you need more deviation, consider updating the template first.
