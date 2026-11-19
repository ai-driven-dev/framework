---
objective: "An agent built for Antigravity carries the agy tool names it needs, so an agent with no tool list can write files and run commands under agy."
status: implemented
---

# Plan: Antigravity agents emitted with agy tool names

Source: https://github.com/ai-driven-dev/framework/issues/1250

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Agy tool names in the Antigravity agent build | [`phase-1.md`](./phase-1.md) | none |
| 2   | Agent generator writes agy tool names | [`phase-2.md`](./phase-2.md) | none |
| 3   | Runtime proof on agy and contributor gates | [`phase-3.md`](./phase-3.md) | 1, 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| https://antigravity.google/docs/subagents | `tools` is a `string[]` defaulting to `[]`; no wildcard; an unknown name may hang the subagent; its example names (`view_file`, `replace_file_content`) are stale against agy 1.5.x |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | names observed: agy 1.5.9 ships the Claude subagent conversion in its built-in `migrate-agent-settings` skill (no `tools` gives `read_file`, `edit_file`, `write_file`, `run_command`, `manage_task`, `search_web`; per-grant map; unmapped grants dropped), and an interactive 1.5.9 session lists the same names; a subagent without `tools` observed with `read_file`, `manage_task`, `send_message` only. The delegation journey with the new list is unverified: `agy -p` from this shell answers "You are not logged into Antigravity" | phase 3 |
| regression | medium: `portable-agent.unit.test.ts` and `antigravity/build.unit.test.ts` lock today's frontmatter; the framework build golden hashes every `.agents/agents/*/agent.md`; `antigravity-restore-regressions.e2e.test.ts` uses `toMatchObject` and stays green | phase 1 |
| architecture | none: the tool table lives in the Antigravity profile beside its hooks map; `portableAgentFrontmatter` keeps parsing the source list and gains no host knowledge | phase 1 |
| documentation | `06-agent-generate/references/agent-authoring.md` A3 says the host gives a new agent its tools by default, false for agy; `tool-paths.md`, named by the issue, was replaced upstream by `hosts.md` and `scripts/write-agent.cjs`, whose antigravity host passes Claude tool names through | phase 2 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `coding-assertions.md`: test first, watch it fail | the tool list is a guard; it ships with the failing test that proves it |
| `coding-assertions.md`: no code for an unobserved input | only names agy 1.5.9 documents for a converted Claude subagent enter the table; nothing beyond its conversion rule |
| `docs/ARCHITECTURE.md` placement | the Claude to agy naming belongs to the Antigravity profile, as the issue and #1194 require |
| a skill never links outside itself (`architecture.md`) | the agent writer cannot import the CLI table, so it carries its own copy of agy's rule |
| `.claude/rules/04-tooling/4-cli-test-cleanup.md` | every agy chat the runtime proof creates is deleted |
| `.claude/rules/01-standards/2-tracker-ids.md` | no ticket id or date in code, tests or docs |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| A source agent with no `tools` gets the full verified agy list | Claude semantics: no list means every tool; agy's empty default is read-only |
| Declared Claude tool names are translated per agy's own conversion rule; names with no agy equivalent are dropped | the CLI installs third-party Claude plugins whose agents declare `tools`; passing a Claude name through may hang agy, and dropping only narrows access |
| The delegation proof runs in the user's logged-in agy session when this shell cannot authenticate; the pull request stays draft until it passes | the interactive session is authenticated while `agy -p` from the agent shell is not; shipping an unproven tool list risks a hanging subagent |
