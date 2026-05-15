← [aidd-framework](../../../../README.md) / [aidd-pm](../../README.md)

# 01 - Ticket Info

Reads ticket details from the configured ticketing tool and displays them in
the chat. Read-only and tool-agnostic: the same skill works whether the
project is on Jira, Linear, GitHub Issues, or any other tracker recorded in
the project memory.

## When to use

- "ticket info", "show ticket", "get ticket", "ticket details".
- "what's <id>" when `<id>` looks like a ticket reference.
- Invoking `/ticket-info`.
- Pulling a ticket id from the current branch name when no id is supplied.

## When NOT to use

- To create a new issue, use a skill that advertises issue creation in its description (run `/plugin` and browse the **Discover** tab to find one).
- To comment on, transition, or reassign a ticket - this skill is read-only.
- For free-form ticket searches across a project; this skill targets one id.

## How to invoke

```
Use skill aidd-pm:01:ticket-info on <ticket-id>
```

Or, with no id, let the skill auto-detect from the current git branch:

```
Use skill aidd-pm:01:ticket-info
```

## Outputs

- A chat-rendered summary of the ticket: id, title, status, assignee, type,
  priority, and description, formatted per the configured tool's conventions.
- No files written. No tracker mutations.

## Prerequisites

- Project memory declares the active ticketing tool (or repo config /
  environment makes it inferable).
- Auth for that tool is reachable from the runtime (MCP server, CLI, or API
  token already configured at the project level).

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract and
[`actions/01-ticket-info.md`](actions/01-ticket-info.md) for the single
atomic action that resolves the id, queries the tool, and formats output.
