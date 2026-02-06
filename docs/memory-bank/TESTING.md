---
name: testing
description: Testing strategy and guidelines
argument-hint: N/A
---

# Testing Guidelines

This document outlines the testing strategies and guidelines for the project.

**Mandatory rules:**

- E2E tests covering 100% of the feature
- **No mocks** (real files, real filesystem)
- Tests in `src/__tests__/`

## Tools and Frameworks

- **Vitest** - Test runner
- **Node.js Test Fixtures** - Isolated test environments in `output-tests/`

## Testing Strategy

- **Behavior-Driven** - Test behaviors, not implementations
- **No mocking** - Use real implementations
- **Minimal approach** - Fewer tests that cover more ground

### Types of Tests

- **Unit Tests** (`*.test.ts`) - Single function/class behavior
- **E2E Tests** (`*.e2e.test.ts`) - Full installation flows with real filesystem

## Decoupling Rules

- Never couple tests to specific IDEs, plugins, or external tools
- Test the contract/interface, not the concrete implementation
- Use generic assertions over specific values when possible

## Naming Conventions

- Describe the behavior: `"returns plugins when servers selected"`
- Avoid implementation details in test names
- No `"should"` prefix needed

## Assertions

Prefer behavioral assertions:

| Prefer               | Avoid         |
| -------------------- | ------------- |
| `toBeTruthy()`       | `toBe(true)`  |
| `toBeFalsy()`        | `toBe(false)` |
| `toHaveLength(0)`    | `toEqual([])` |
| `toBeGreaterThan(0)` | `toBe(3)`     |

## What to Test

- Edge cases (empty inputs, undefined, null)
- Happy path (main use case)
- Error conditions

## What NOT to Test

- Each IDE/plugin individually (creates coupling)
- Internal private methods
- Implementation details that may change

## Rules for writing tests

- Never skip any tests.
- Never mock.
- Never use `jscpd:ignore-start` or similar to bypass duplication checks.
- Avoid `any` type; prefer `unknown` + type guards.
- Do not use `ts-ignore`, always ask me before bypassing type checks.
