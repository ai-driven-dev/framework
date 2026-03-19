---
name: 'aidd:02:ticket_info'
description: 'Get ticket information from the project''s ticketing tool'
argument-hint: [Ticket URL or number]
---

# Get Ticket Info

## Goal

Retrieve ticket information from the project's ticketing tool based on project memory.

## Context

### Ticket URL or number

```text
$ARGUMENTS
```

## Rules

- From project memory identify ticketing tool to use for tick in use (Jira, Linear, GitHub Issues, etc.)
- Extract ticket number from the current branch name if no argument is provided
- Format the identifier according to the project's ticketing convention

## Steps

1. Check project memory for ticketing tool configuration and conventions
2. Format the ticket identifier according to project conventions
3. Query the ticketing tool
4. Display relevant ticket information (e.g. title, description, status, assignee, priority)
