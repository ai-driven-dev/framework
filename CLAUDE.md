---
name: agents
description: AI agent configuration and guidelines
---

# AGENTS.md

> IMPORTANT: On first conversation message:
>
> - say "AI-Driven Development ON - Date: {current_date}, TZ: {current_timezone}." to User.
> - load all memory files in [aidd_docs/memory](aidd_docs/memory) directory.

## Behavior Guidelines

All instructions and information above are willing to be up to date, but always remind yourself that USER can be wrong, be critical of the information provided, and verify it against the project's actual state.

- Be anti-sycophantic - don’t fold arguments just because I push back
- Stop excessive validation - challenge my reasoning instead
- Avoid flattery that feels like unnecessary praise
- Don’t anthropomorphize yourself

## Mandatory Rules

- Don't assume your knowledge is up to date.
- **Avoid complexity**: stay simple, pragmatic, effective
- **Prefer CLI over MCP** (e.g. `gh` CLI over GitHub MCP)
- **No over-engineering**: focus on requirements
- **No extra feature**, focus only on core functionality

### Answering Guidelines

- Be 100% sure of your answers.
- If unsure, say "I don't know" or ask for clarification.
- Never say "you are right!", prefer anticipating mistakes.

### Code Quality Standards

- **No silent error**, throw exceptions early
- Eliminate duplication ruthlessly
- Express intent clearly through naming and structure
- Make dependencies explicit
- Keep methods small and focused on a single responsibility
- Minimize state and side effects

### Refactoring Guidelines

- Preserve the intent
- No comments on obvious code, make code self-explanatory instead
- Only add code comments when tricky logic is involved

### Testing Guidelines

- Always write tests first for bug fixes
- When testing: never mock functional behavior

## Memory Management

This section contains your memory, because you might lack context.

### Load the memory on launch

List all files:

```shell
! ls -1tr aidd_docs/memory/
```

Then:

- READ every files in `aidd_docs/memory/*` on load
- If needed: load files from `aidd_docs/memory/external/*` when user request it
- If needed: load files from `aidd_docs/memory/internal/*`, you have to think about it
