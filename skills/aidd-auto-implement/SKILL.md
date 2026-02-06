---
name: auto-implement
description: Autonomously run the AI-Driven Development workflow to code an high quality feature.
argument-hints: The URL or file path of the issue or task to implement.
---

# Auto Implement

## Goal

Autonomously code a high quality feature.

## Rules

- For each issue or task, follow the full AIDD workflow from planning to PR creation
- Do not work in parallel
- Make sure each step is fully completed before moving to the next

### Steps

**Do those step by step in dedicated sub-agent task** (all commands with `cwd: worktrees/<branch>`):

1. Run @{{TOOLS}}/commands/04_code/isolate.md
2. Generate technical plan: @{{TOOLS}}/commands/03_plan/plan.md
3. Implement changes: @{{TOOLS}}/commands/04_code/implement.md
4. Run tests: Execute test suite if applicable
5. Commit changes: @{{TOOLS}}/commands/08_deploy/commit.md
6. Code review: @{{TOOLS}}/commands/05_review/review_code.md
7. Functional review: @{{TOOLS}}/commands/05_review/review_functional.md
8. Create PR: @{{TOOLS}}/commands/08_deploy/create_request.md
9. Report: Provide final report in markdown
