---
name: jira_info
description: Get JIRA ticket info from current branch
argument-hint: Jira URL or number
---

# JIRA Info Prompt

## Goal

Extract JIRA ticket information based on current branch name.

## Context

- Ues "$ARGUMENTS" as JIRA URL or number

## Rules

- Branch format: feature/[NUMBER]
- JIRA ID: FID-[NUMBER]
- Atlassian MCP integration
- Extract ticket number from branch
- Use Atlassian MCP for data retrieval
- Format as FID-[NUMBER]

## Process steps

1. Extract ticket number from current branch name
2. Format as FID-[NUMBER] identifier
3. Query JIRA using Atlassian MCP integration
4. Retrieve complete ticket data
5. Display relevant ticket information
