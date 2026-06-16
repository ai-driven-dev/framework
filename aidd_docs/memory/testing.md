# Testing Guidelines

## Tools and Frameworks

- **Playwright MCP**: browser automation available via `.playwright-mcp/` config, used for manual or AI-driven UI testing on downstream projects

## Testing Strategy

- No unit test runner configured at framework level
- Skills are validated by running each action's `## Test` end-to-end against a real environment
- Framework correctness validated by running actual skills against a real project (integration)

## Test Execution Process

- Each action declares a `## Test` (a command to run, an artifact check, or an observable side-effect) that must pass before the next action runs
- `scripts/build-dist-verification.md` documents how to verify the build output

## Mocking and Stubbing

Not applicable: the framework has no runtime; all logic is markdown interpreted by an LLM.
