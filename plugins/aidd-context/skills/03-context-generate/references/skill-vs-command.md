# Skill vs slash command vs hook — decision guide

Not every repeatable instruction is a skill. Use this guide before creating one.

## Build a skill when

- There are ≥ 2 distinct actions that branch based on user intent.
- At least one action has a non-trivial test policy (MCP calls, script validation, external state to verify).
- The instructions reference external data (API IDs, templates, style guides) that benefits from living in `assets/` or `references/`.
- Multiple users will invoke it with varying phrasings — description-based routing adds value.
- The behavior must be available for implicit triggering by Claude, not only on explicit user invocation.

## Build a slash command when

- There is exactly one action, always the same.
- No external data dependency beyond what fits in the command file.
- The user always types the command explicitly — no auto-triggering needed.
- The output is a transformation of the current context with no dispatch logic.

## Build a hook when

- The behavior must trigger on an event (file write, tool call, session start, agent stop), not on user intent.
- There is no conversation — just a deterministic reaction.
- In Claude Code, hooks are configured in `settings.json` (see the `update-config` skill).

## Examples

| Case                                                              | Right answer   | Why                                                          |
| ----------------------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| Post a message, fetch history, create a channel on Slack          | skill `slack`  | multiple actions, channel-ID data, MCP verification          |
| Format this JSON blob                                             | slash command  | one-shot transformation, no routing                          |
| Code review with functional / technical / e2e / security lenses   | skill `review` | branches on review type, each with distinct tests            |
| Block `Edit` on `.env` files                                      | hook           | event-driven, no user prompt                                 |
| Generate a commit message                                         | slash command OR skill — skill if it includes conventional-commit validation + loop; command otherwise |
| Run a recurring cleanup task every Monday                         | scheduled agent | time-triggered, not user-triggered                          |

## Anti-pattern: single-action skill

If a skill ends up with only one action, the router adds overhead with no benefit. Either:

- Add meaningful branches (a second action that justifies the dispatch), OR
- Collapse into a slash command.

Action 01 (`capture-intent`) of the `generate-skill` skill must detect this case and propose the slash-command alternative before proceeding.
