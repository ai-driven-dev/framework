---
objective: "Generate documented native options for the five context generators through their existing host-specific formats."
status: implemented
---

# Plan: Native generator options

Source: Approved interactive SDLC contract for host-native generator options and Kilo project generation.

## Phases

| # | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1 | Native agent and command options | [`phase-1.md`](./phase-1.md) | none |
| 2 | Native skill metadata and hook options | [`phase-2.md`](./phase-2.md) | 1 |
| 3 | Native rules, Kilo detection and delivery checks | [`phase-3.md`](./phase-3.md) | 1, 2 |

## External sources

| URL | What it settled |
| --- | --- |
| https://kilo.ai/docs/customize/custom-subagents | Kilo documents numeric temperature and a permission object in Markdown agent metadata. |
| https://kilo.ai/docs/customize/workflows | Kilo documents string variant and boolean subtask in Markdown commands. |
| https://kilo.ai/docs/getting-started/settings | Kilo reads project JSONC at the root and under its project folder. |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| Runtime | Local host binaries were found on PATH. Native option behavior, credentials and test feasibility are unverified until exercised. The existing hook suite copies a standalone installed skill into a separate folder. | 1, 2, 3 |
| Regression | Agent and command host mappings filter payloads, skills write scaffolds, hooks preserve owned entries, and rule publishing reparses canonical sources. Existing generation and contract suites are the baseline. | 1, 2, 3 |
| Architecture | The context plugin owns project generation. The CLI JSONC adapter lives in a separate installable. Prove any reused JSONC editor is available in the installed context skill. | 3 |
| Documentation | Update existing skill actions and their writer or host references. Record the revised Kilo criteria and observed host checks in the outcome. | 1, 2, 3 |

## Rules

| Rule | Why it applies |
| --- | --- |
| [Architecture](../../../memory/architecture.md) | Skill assets must work from an installed skill tree. |
| [Coding assertions](../../../memory/coding-assertions.md) | Write regression tests first and run the applicable contributor gates. |
| [Testing](../../../memory/testing.md) | Keep tests in the existing scripts suites and run them with the Git hooks wrapper. |

## Decisions

| Decision | Why |
| --- | --- |
| Keep native values attached to their target and use each existing writer. Reuse implementation only where it fits the installed skill boundary. | The five artifact formats have different locations and ownership rules. A shared catalog of vendor options would duplicate their documentation. |
