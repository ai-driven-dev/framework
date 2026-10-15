# Delegation

The caller chooses bounded work, invokes the agent, and accepts the result. Project settings suggest a role and native options; they do not start agents or change host settings.

## Configure

Merge a `delegation` entry into the project's `.aidd/config.json`, preserving its other keys:

```json
{
  "delegation": {
    "exploration": {
      "agent": "aidd-dev:explorer",
      "tools": {
        "claude": { "model": "haiku", "effort": "low" },
        "codex": { "model": "gpt-6-luna", "effort": "high" },
        "opencode": { "model": "openai/gpt-6-luna", "effort": "low" },
        "copilot": { "model": "gpt-6-luna" },
        "cursor": {}
      }
    }
  }
}
```

Use `implementation` → `aidd-dev:executor`, `validation` → `aidd-dev:validator`, and `verification` → `aidd-dev:reviewer` for the other tasks. Task names are caller-defined. Omitted settings keep native inheritance; no model is installed as a framework default.

```sh
aidd delegation resolve exploration --tool claude --json
```

Resolution verifies the installed agent and returns its native identity, requested settings, native suggestion, and target surface. `agent-configuration` fields belong in a native agent definition; `spawn` fields belong to the host's invocation. These are suggestions, not proof of application: effective runtime stays `unknown`. The caller uses a supported native equivalent, or explains why it overrides or cannot apply the suggestion. Invalid settings and unavailable agents fail with a diagnostic. Resolution writes nothing.

## Model starting points

Editable choices, conditional on the account's available models. Keep simple lookups direct; delegate bounded questions or repetitive work when the context saved justifies startup. Measure the whole parent-and-child run before choosing a cheaper model for a recurring task.

| Host | Routine exploration / implementation / validation | Ambiguous work / review | Native model and effort |
| --- | --- | --- | --- |
| Claude Code | `haiku`, `low` | `opus`, `high` | `model` and `effort`; aliases resolved by Claude |
| Codex | `gpt-6-luna`, `high` | `gpt-6.1-sol`, `high` | `model` and `model_reasoning_effort` |
| OpenCode V2 | `openai/gpt-6-luna`, `low` | `openai/gpt-6.1-sol`, `high` | `model: provider/model#variant` |
| GitHub Copilot | `gpt-6-luna`, inherited effort | Inherit the caller's selected model | Agent `model` / `reasoningEffort`; invocation support differs |
| Cursor | Inherit | Inherit; select an advertised model slug when available | Plugin Task `model`; flat agent `model[effort=level]` |

- **Availability:** local Codex accepted `gpt-5.6-sol` with `low`; requests for `gpt-6-luna` were rejected by the signed-in backend. The recommendation is not an account entitlement.
- **Precedence:** Codex agent-file pins override spawn settings. Claude environment or managed settings can override requests. OpenCode variants belong to the selected model. Keep model IDs literal; avoid translating aliases between providers.
- **Copilot:** tested 1.0.98. A per-call `gpt-6-luna` override worked while the same root CLI selection failed. Actual child effort remained `medium` despite a low request; omit effort on this account rather than claim it applied.
- **Cursor:** the tested Free account accepts Auto/inheritance and rejects named-model execution. Plugin frontmatter model settings are stripped; use Task's advertised model slug. Plugin effort has no independent parameter; the resolver rejects it. Flat model options require an explicit model.

Sources read **2026-10-15**: [Claude selection and effort](https://code.claude.com/docs/en/sub-agents), [Codex selection and precedence](https://learn.chatgpt.com/docs/agent-configuration/subagents), [OpenCode V2 agents](https://opencode.ai/v2/docs/agents), [OpenCode variants](https://opencode.ai/v2/docs/models), [Copilot CLI agent configuration](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference), [Cursor subagents](https://cursor.com/docs/subagents). Versioned observations and limitations are recorded in the [verification record](../aidd_docs/tasks/2026_10/2026_10_14_sub_agents/verification.md).

## Test a change

1. **Resolve:** use a disposable project with the generated native agents and a delegation entry. Run the command above for each host. Check native identity/options; omit settings and confirm no defaults appear. Try a missing role or unsupported option and confirm a diagnostic. Compare configuration bytes before and after.
2. **Invoke:** start the resolved role through the native host. Test read-only exploration, a bounded implementation, a failing completion check, and an independent quality review. Confirm only the executor changes assigned files.
3. **Inspect:** record host version, invocation, delivery mode and scope. Use native dispatch events and model/effort traces; an agent's self-report or a generated file does not prove execution. Record substitutions, unavailable values and inherited settings.
4. **Compare:** run the same exploration and repetitive implementation directly and through a fresh child. Record all parent/child input, cached input and output tokens, latency, task retries, and independently checked output quality. Keep failed attempts visible. Host cost estimates depend on cache state and do not establish general savings.

`make reload` refreshes every plugin and the managed agent table for installed hosts. Cursor local plugin imports must be enabled. Restart hosts or reload their configuration before testing discovery.
