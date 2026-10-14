---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Portable agents under `.agents/agents/<name>/agent.md`

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
cli/
├── src/contexts/tools/domain/formats/
│   └── portable-agent.ts            ✅ rebuild frontmatter: name, description, model: inherit, tools as YAML list; drop everything else
├── src/contexts/tools/domain/profiles/antigravity/
│   ├── antigravity-paths.ts         ✏️ agents dir
│   ├── profile.ts                   ✏️ AgentsCapability, nested `<name>/agent.md`
│   └── build.ts                     ✏️ agents artifact, link rewriting relative to the nested path
├── tests/contexts/tools/domain/formats/
│   └── portable-agent.unit.test.ts  ✅ model mapping, tools string → list, Claude-only keys dropped, empty description rejected
├── tests/contexts/tools/domain/profiles/antigravity/build.unit.test.ts   ✏️ agent path and body
└── tests/golden/snapshots/framework-build/golden.json   ✏️ `antigravity:flat` cell only
```

## User Journey

```mermaid
flowchart TD
  A[source agent plugins/aidd-dev/agents/executor.md, model: opus, tools: a, b] --> B[aidd setup / translate antigravity]
  B --> C[.agents/agents/aidd-dev-executor/agent.md]
  C --> D[frontmatter: name, description, model: inherit, tools list]
  D --> E[agy /agents lists aidd-dev-executor]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    fixture agent with model opus, comma tools and a Claude-only key => source ready: 5: system
  section Happy path
    translate --to antigravity --as flat => .agents/agents/<plugin>-<agent>/agent.md written: 5: cli
    read frontmatter => name, description, model inherit, tools YAML list, nothing else: 5: cli
    aidd setup --ai antigravity => same file recorded in manifest: 5: cli
  section Edge case - no tools
    source agent without tools => translate => no tools key emitted: 5: cli
  section Edge case - empty description
    source agent with blank description => translate => build fails naming the agent: 1: cli
  section Edge case - flat shape
    any build => no .agents/agents/<name>.md file exists: 5: cli
```

## Tasks to do

### `1)` Portable frontmatter, test first

> One builder #916 can reuse for Codex flat and Kimi.

1. Tests for the four rules in #916, then implement `portable-agent.ts`.
2. Mutate `model: inherit` back to the source value; watch the model test fail.

### `2)` Antigravity agents in setup and translate

1. `AgentsCapability` and flat `agents` artifact writing `.agents/agents/<plugin>-<agent>/agent.md`, body links rewritten from that nested path.
2. Unit test the path and body; regenerate golden, only `antigravity:flat` moves.

### `3)` Live check

1. Local `agy --add-dir <repo> --output-format json -p "/agents"` lists a generated agent; quote the line in the PR, with an invented-name negative control.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | A source agent with `model: opus` and `tools: "a, b"` yields `model: inherit` and `tools: [a, b]`, and no Claude-only key |
| 2 | Agents land only at `.agents/agents/<name>/agent.md`; only the `antigravity:flat` golden cell changes; full suite passes |
| 3 | `agy /agents` lists the generated agent and not the invented one |
