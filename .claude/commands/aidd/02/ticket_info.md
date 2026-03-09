---
name: 'aidd:02:ticket_info'
description: 'Get ticket information from the project''s ticketing tool'
argument-hint: 'Ticket URL or number'
---

# Get Ticket Info

## Goal

Retrieve ticket information from the project's ticketing tool based on project memory.

## Context

- Use "$ARGUMENTS" as ticket URL or identifier

## Rules

- Read project memory to identify the ticketing tool in use (Jira, Linear, GitHub Issues, etc.)
- Use the appropriate MCP integration for the detected ticketing tool
- Extract ticket number from the current branch name if no argument is provided
- Format the identifier according to the project's ticketing convention

## Steps

1. Check project memory for ticketing tool configuration and conventions
2. If no "$ARGUMENTS" provided, extract ticket number from current branch name
3. Format the ticket identifier according to project conventions
4. Query the ticketing tool using the appropriate MCP integration
5. Display relevant ticket information (title, description, status, assignee, priority)
