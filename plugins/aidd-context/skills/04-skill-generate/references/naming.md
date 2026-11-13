# Naming

| Item | Rule | Example |
| --- | --- | --- |
| Skill of a tool | singular noun | `slack` |
| Skill of an activity | action verb | `review` |
| Skill format | kebab-case, at most 64 chars, equal to its folder | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| Skill, reserved | never `anthropic` or `claude` | |
| Skill, avoid | redundant prefix, vague noun, gerund | `skill-slack`, `helper`, `reviewing` |
| Action | kebab-case verb phrase, `NN-` prefix when order is strict; the slug drops it | `01-post-message`, slug `post-message` |
