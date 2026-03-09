---
name: 'auto-implement'
description: 'Autonomously runs the AI-Driven Development workflow to implement a high-quality feature. Use when you need to code a feature end-to-end without manual intervention.'
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

4. Brainstorm implementation approach: .claude/commands/02_context/brainstorm.md
5. Generate technical plan: .claude/commands/03_plan/plan.md
6. Implement changes: .claude/commands/04_code/implement.md
7. Run tests: Execute test suite if applicable
8. Commit changes: .claude/commands/08_deploy/commit.md
9. Code review: .claude/commands/05_review/review_code.md
10. Functional review: .claude/commands/05_review/review_functional.md
11. Create PR: .claude/commands/08_deploy/create_request.md
