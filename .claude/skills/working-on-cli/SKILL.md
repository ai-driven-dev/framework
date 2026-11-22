---
name: working-on-cli
description: Governs any change under cli/ (a tool, a command, a business rule, a failure path, a test, a context). Use before editing cli/src, cli/tests, cli/assets or cli/biome-plugins. Not for plugins/.
---

# Working on the CLI

Paths are rooted at `cli/`. Read the action for the change, then what it loads.

| The change | Action |
| --- | --- |
| Add an AI tool, or follow a host's format change | `actions/01-tool.md` |
| Add or change a command | `actions/02-command.md` |
| Change a business rule inside a context | `actions/03-domain.md` |
| Handle an error, a missing or unreadable file, a partial failure | `actions/04-failure.md` |
| Write or fix a test | `actions/05-test.md` |
| Create, split or move a context | `actions/06-context.md` |

Shared by every action: `references/architecture.md`, and `references/contexts/<ctx>.md` for each context touched (`auth`, `distribution`, `host-registration`, `installation`, `machine-claims`, `recipes`, `telemetry`, `tools`, `translate`, `update`).

## Always

- Write the test first and see it fail for the reason its name gives: `aidd_docs/memory/coding-assertions.md`.
- Done means the gates in `aidd_docs/memory/coding-assertions.md` are green. A red gate is fixed at its cause, never by an exemption, a wider allow-list or a raised debt count.
- `tests/architecture/kinds-debt.json` only shrinks: an entry is lowered when its code is fixed, never added or raised.
- A change to a golden, an e2e output or a fixture is a product change: say so in the commit.
- Never run `setup`, `marketplace add` or `plugin install` at the repository root, nor a real AI host binary in a test: `aidd_docs/memory/testing.md`.
- Commit and push only when the user asks: `AGENTS.md`.
- Memory states a fact once: point to `aidd_docs/memory/` instead of restating it here.
