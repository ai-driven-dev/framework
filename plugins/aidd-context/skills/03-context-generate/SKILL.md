---
name: 03-context-generate
description: Routes requests to generate skills, rules, agents, commands, hooks or scheduled task prompts when the type of artifact is unclear.
argument-hint: skill | rule | agent | command | hook | scheduled task
---

# Context Generate

```mermaid
flowchart LR
  entry([request]) --> kind{"kind named?"}
  kind <-->|"unclear: ask which kind"| user((user answers))
  kind -->|"skill"| skill((aidd-context:04-skill-generate))
  kind -->|"rule"| rule((aidd-context:05-rule-generate))
  kind -->|"agent"| agent((aidd-context:06-agent-generate))
  kind -->|"command"| command((aidd-context:07-command-generate))
  kind -->|"hook"| hook((aidd-context:08-hook-generate))
  kind -->|"scheduled task"| schedule((aidd-context:14-schedule-generate))
  entry -->|"survey or list existing artifacts"| stopped((stopped: use the explore skill))
```
