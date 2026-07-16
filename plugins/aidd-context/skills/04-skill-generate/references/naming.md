# Naming

## Skill name

| Domain   | Name it       | Example           |
| -------- | ------------- | ----------------- |
| tool     | singular noun | `slack`, `stripe` |
| activity | action verb   | `review`, `test`  |

Kebab-case, at most 64 chars, equal to the folder name (`^[a-z0-9]+(-[a-z0-9]+)*$`). `anthropic` and `claude` are reserved. Avoid a redundant prefix (`skill-slack`), a vague noun (`helper`), or a gerund (`reviewing`).

## Action name

Kebab-case verb phrase (`post-message`), a numbered prefix when order is strict. The slug drops the prefix.

## Collision check

List the installed skills, scan for description overlap. Two triggering on the same phrase means one is wrong: merge, rename, or tighten.
