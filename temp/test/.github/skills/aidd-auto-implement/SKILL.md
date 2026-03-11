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

1. Brainstorm implementation approach: .github/prompts/02-brainstorm.prompt.md
2. Generate technical plan: .github/prompts/03-plan.prompt.md
3. Implement changes: .github/prompts/04-implement.prompt.md
4. Run tests: Execute test suite if applicable
5. Commit changes: .github/prompts/08-commit.prompt.md
6. Code review: .github/prompts/05-review-code.prompt.md
7. Functional review: .github/prompts/05-review-functional.prompt.md
8. Create PR: .github/prompts/08-create-request.prompt.md
