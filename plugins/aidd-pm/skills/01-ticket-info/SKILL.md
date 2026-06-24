---
name: 01-ticket-info
description: Retrieve and display ticket information from the configured ticketing tool. Use when the user says "ticket info", "show ticket", "get ticket", "ticket details", "what's <id>", or invokes `/ticket-info`. Do NOT use for creating issues, commenting on tickets, changing status, or reassigning.
---

# Ticket Info

Reads ticket details from the configured ticketing tool. Read-only and tool-agnostic.

## Actions

| #   | Action         | Role                                                          | Input                              |
| --- | -------------- | ------------------------------------------------------------- | ---------------------------------- |
| 01  | `ticket-info`  | Resolve ticket id, query the configured tool, display fields   | ticket_id (optional)               |

## Default flow

Single action skill. The router dispatches to `ticket-info` whenever a ticket-lookup phrase appears.

## Transversal rules

- Read the configured ticketing tool from project memory first; otherwise inspect repo configuration or environment.
- Auto-detect the ticket identifier from the current branch name when none is provided.
- Format the identifier per project convention before querying.
- Read-only: never create, comment, transition, or reassign from this skill.
