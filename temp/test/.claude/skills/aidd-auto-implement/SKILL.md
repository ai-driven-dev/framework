---
name: 'auto-implement'
description: 'Autonomously run the AI-Driven Development workflow to code an high quality feature.'
argument-hint: 'The URL or file path of the issue or task to implement.'
---

# Auto Implement

## Goal

Autonomously code a high quality feature.

## Rules

- For each issue or task, follow the full AIDD workflow from planning to PR creation
- Do not work in parallel
- Make sure each step is fully completed before moving to the next

## Process

1. List available MCP tools in bullet list, remember that they can be used.
2. Create a TODO of sequential steps bellow and display in the chat to inform human what you are going to do.
3. **For each step bellow, spawn a new sub-agent task to execute the required commands**

### Steps

1. Brainstorm implementation approach: .claude/commands/aidd/02/brainstorm.md
2. Generate technical plan: .claude/commands/aidd/03/plan.md
3. Implement changes: .claude/commands/aidd/04/implement.md
4. Run tests: Execute test suite if applicable
5. Commit changes: .claude/commands/aidd/08/commit.md
6. Code review: .claude/commands/aidd/05/review_code.md
7. Functional review: .claude/commands/aidd/05/review_functional.md
8. Create PR: .claude/commands/aidd/08/create_request.md
