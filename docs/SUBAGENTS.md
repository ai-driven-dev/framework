# 🤝 Subagents

Four generic agents your AI tool can hand work to, each in a fresh context. They ship with the `aidd-orchestrator` plugin; the skill that calls one gives it its concern, so the same executor writes code under `aidd-dev` and a spec under `aidd-pm`.

## 📑 Contents

- [How it works](#-how-it-works)
- [Which agent for which task](#-which-agent-for-which-task)
- [Install](#-install)
- [Models](#-models)
- [Limits](#-limits)

## 🔀 How it works

The main agent is the conversation window. It loads the host's project instructions, such as [`AGENTS.md` in Codex](https://developers.openai.com/codex/guides/agents-md), and owns the outcome. What subagents receive depends on the host and configuration.

The main agent chooses whether delegation helps. These examples and responses are hypothetical.

### A simple request

When delegation would add overhead, the main agent can handle the request itself.

```mermaid
---
title: Fix a typo
---
sequenceDiagram
  actor User as 👤 User
  participant Main as 🤖 Main agent (orchestrator)
  User->>Main: 💬 "Fix the typo in README.md."
  Main->>Main: 📝 Update README.md and check the diff.
  Main-->>User: 💬 "Fixed the typo in README.md."
```

### A request with subagents

This example shows the decisions, tool calls and possible outcomes for one request. Explorer A is new and Explorer B is reused; their independent tasks run in parallel. Every subagent returns to the main agent.

```mermaid
---
title: Fix signup validation
config:
  flowchart:
    nodeSpacing: 18
    rankSpacing: 30
---
flowchart TD
  User["👤 User<br/>💬 #quot;Allow + in signup emails.#quot;"]
  Main["🤖 Main agent<br/>📖 Load AGENTS.md<br/>⚙️ Choose an approach<br/>⚡ Parallel if independent"]
  Delegate{"Delegate?"}
  ExplorerA["🤖 Explorer A · new<br/>🔎 Search code<br/>↩️ Rejects +"]
  ExplorerB["🤖 Explorer B · reused<br/>🌐 Check policy<br/>↩️ Allows +"]
  Findings["🤖 Main combines findings"]
  Executor["🤖 Executor C<br/>📝 Fix validation<br/>🧪 Run test<br/>↩️ Test passes"]
  Validator["🤖 Validator D<br/>🧪 Verify behavior<br/>↩️ PASS"]
  Verdict{"PASS?"}
  Reviewer["🤖 Reviewer E<br/>🧰 aidd-dev:05-review<br/>↩️ No issues"]
  Review{"Issues?"}
  Other["🤖 Main agent<br/>📝 Handle or repair<br/>🧪 Recheck if needed<br/>💬 Report outcome"]
  Answer["🤖 Main agent<br/>💬 #quot;Fixed. Test passed.#quot;"]

  User --> Main
  Main --> Delegate
  Delegate -- Yes --> ExplorerA
  Delegate -- Yes --> ExplorerB
  Delegate -- No --> Other
  ExplorerA --> Findings
  ExplorerB --> Findings
  Findings --> Executor
  Executor -- via main --> Validator
  Validator -- via main --> Verdict
  Verdict -- PASS --> Reviewer
  Verdict -- FAIL or BLOCKED --> Other
  Reviewer -- via main --> Review
  Review -- No --> Answer
  Review -- Yes --> Other
```

The main agent uses only the roles the task needs. If validation or review finds a gap, it routes the work back for repair. A workflow or user may require specific agents.

When supported, the main agent can choose a lighter model for straightforward research or repetitive work. It still checks the result and chooses a capable model for harder tasks.

Only `/aidd-orchestrator:01-sdlc` names an agent, by its role (`validator`), so a run delegates the same way every time; other workflows ask for a responsibility. The host resolves the role to its install, `aidd-orchestrator:validator` from the Claude Code marketplace or `aidd-orchestrator-validator` in a project distribution, or gives the brief to its default subagent when the agent is not installed.

## 🧭 Which agent for which task

| Agent | Use it to | It returns | Writes files, by instruction |
| --- | --- | --- | --- |
| [Explorer](../plugins/aidd-orchestrator/agents/explorer.md) | Investigate scoped questions across code, documentation, services or the web | The answer, with sources and unknowns | No |
| [Executor](../plugins/aidd-orchestrator/agents/executor.md) | Write or fix code and docs within a defined scope, then verify them | `COMPLETE`, `INCOMPLETE` or `BLOCKED`, with changes and checks run | Yes |
| [Validator](../plugins/aidd-orchestrator/agents/validator.md) | Confirm delivered work meets the request and its acceptance criteria | `PASS`, `FAIL` or `BLOCKED`, with evidence | No; runs checks |
| [Reviewer](../plugins/aidd-orchestrator/agents/reviewer.md) | Find defects, contradictions, duplication and needless complexity in finished work | `no actionable findings`, `changes needed` or `insufficient evidence`, with findings | No; only the review report a workflow asks for |

## 📦 Install

Install the `aidd-orchestrator` plugin: `/plugin install aidd-orchestrator@aidd-framework` in Claude Code, or see the [quick start](../README.md#quick-start) for the other tools. The agents come with it, except as a Codex plugin (see [Limits](#-limits)); open a new session so the tool loads them.

## 🧠 Models

No model is pinned. Each host applies its own default for subagents, usually the model of the session that called them. A model you declare in an agent reaches every host in its own format.

## 🚧 Limits

- **Tools:** every agent inherits the calling session's tools and permissions; what it writes is an instruction, not a restriction.
- **Codex:** a Codex plugin cannot carry agents, so only the flat distribution installs them, in `.codex/agents/`. Codex loads them only in a trusted project.
- **Models:** OpenCode V1 reads the same file but not the `#<effort>` variant.
- **Updates:** reinstalling replaces the agents still shipped; one removed from the plugin stays where a copy put it until you delete it.

Sources: [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents), [Copilot custom agents](https://docs.github.com/en/copilot/reference/custom-agents-configuration), [OpenCode agents](https://opencode.ai/v2/docs/agents), [Codex subagents](https://developers.openai.com/codex/subagents), [Cursor subagents](https://cursor.com/docs/subagents).
