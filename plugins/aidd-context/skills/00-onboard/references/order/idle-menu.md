# Idle menu

When ranks 1-3 are clear, `02-assess` offers three umbrellas plus explore.

| Slot | Umbrella            | Opens (installed members)                                                                 |
| ---- | ------------------- | ----------------------------------------------------------------------------------------- |
| 1    | start new work      | `aidd-dev:00-sdlc` (or `aidd-pm:04-spec`) — a feature from idea to shipped                 |
| 2    | improve the project | `aidd-dev:04-audit` · `aidd-dev:06-test` · `aidd-dev:07-refactor`                          |
| 3    | customize the AI    | the **missing** context-gen generators, each in plain words: a coding rule (`aidd-context:05-rule-generate`), a reusable workflow (`aidd-context:04-skill-generate`), a specialized assistant (`aidd-context:06-agent-generate`), a slash command (`aidd-context:07-command-generate`), an automated action (`aidd-context:08-hook-generate`) |
| ?    | explore             | `aidd-context:11-explore` and anything not in slots 1-3                                    |

- Slots 2 and 3 are umbrellas: a pick re-renders the installed member sub-list; a member pick runs it. Slot 1 runs directly.
- Surface an installed member only; drop an umbrella with no member.
- Choices, not a chain: `OK` never walks the idle menu.
