# Framework artifact validation, tranche 1

## Target

Every artifact the framework generates or ships is checked against its own declared contract, with the same verdict for the model writing it, for a contributor, and for CI.

## Hard constraints

- Deterministic: no model, no network; the same input always gives the same findings.
- Runs with the framework alone, on a plain Node install, without the CLI or any dependency.
- Each skill stays self-contained: it never reaches into another skill's folder, so it still works once a host renames or flattens skills.
- One contract per artifact kind holds its rules; the checker knows no kind.
- A finding names the file, the line, the rule and the fix, and the run exits non-zero on any finding.
- A broken contract stops the run instead of silencing a rule.
- Placing a template never validates it; validating never writes.
- The skill description limit stays at 150 characters.
- Every template marks the slots to fill one single way.
- Rules are validated as their neutral source only, never as host copies.
- CI blocks only findings absent from a recorded baseline of today's tree.

## Non-goals

- Fixing the findings that exist today.
- The weighted spec rubric graded by a model.
- HTML, CSS and JavaScript assets beyond a parse check of hook handlers.
- Validating archived plans in CI.
- Wiring checks into git hooks, which #1165 owns.
- Changes to how commits are made during implementation.

## Done-when

- Skills give the same findings as today's skill checker, except its one known false positive.
- Plans keep today's validated behavior, with no check that duplicates the placement of the plan folder.
- Agents, plans, runs, rules, commands, stories, hook configurations and plugin manifests each have a contract that rejects their raw template and accepts a filled one.
- A plugin whose manifest lists a skill that does not exist, omits one that does, or describes itself differently from the marketplace is reported.
- A hook configuration naming a handler that is missing or does not parse is reported.
- A copy of the shared checker inside a skill that differs from its source is reported.
- Implementation no longer records a baseline commit, and stops to ask when the tree is modified outside the feature folder.
- CI passes on today's tree and fails on a newly introduced finding.
- Every existing repository test still passes.

## Open Questions

None.

## Context

- Issue: https://github.com/ai-driven-dev/framework/issues/1149
- Hooks gating: https://github.com/ai-driven-dev/framework/issues/1165
