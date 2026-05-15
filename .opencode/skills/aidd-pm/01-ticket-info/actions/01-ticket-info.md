# 01 - Ticket Info

Resolve the ticket identifier, query the configured ticketing tool, and display the relevant fields.

## Inputs

```yaml
ticket_id: <id or url>     # optional; auto-detect from current branch name when omitted
```

## Outputs

```yaml
ticket_id: <id>
title: <title>
description: <body>
status: <status>
assignee: <assignee>
priority: <priority>
url: <url>
```

## Process

1. **Tool resolution**. Pick first match:
   - ticketing tool declared in project memory -> use it
   - default -> inspect repo configuration or environment for the configured tool
2. **Ticket identifier**. Pick first match:
   - `ticket_id` provided -> use it
   - default -> extract from `git rev-parse --abbrev-ref HEAD` per project convention
3. **Format**. Apply the project ticketing convention to the identifier (prefix, separator, casing).
4. **Query**. Invoke the configured ticketing tool to fetch the ticket record.
5. **Display**. Render title, description, status, assignee, priority, and URL for the user.
6. **Return** the structured Outputs block.

## Test

- **Tool view**: querying the configured ticketing tool for the resolved id returns a record where `title`, `status`, `assignee`, and `url` match the displayed fields.
- **Reachable**: the ticket is reachable at `url` in the tracker.
