---
name: auto-implement
description: Autonomously run the AI-Driven Development workflow to code an high quality feature.
argument-hint: The URL or file path of the issue or task to implement.
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

1. Brainstorm implementation approach — skill `brainstorm` action `01-brainstorm`
2. Generate technical plan — skill `plan` action `01-plan`
3. Implement changes — skill `sdlc` action `01-implement`
4. Run tests: Execute test suite if applicable
5. Commit changes — skill `commit` action `01-commit`
6. Code review — skill `review` action `01-review-code`
7. Functional review — skill `review` action `02-review-functional`
8. Create PR — skill `pull-request` action `01-pull-request`
