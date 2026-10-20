# 🤝 Optional subagents (beta)

## 📑 Contents

- [Roles](#-roles)
- [Models and IDEs](#-models-and-ides)
- [Install](#-install)
- [Try a small task](#-try-a-small-task)
- [Update or remove](#-update-or-remove)
- [Beta limitations](#-beta-limitations)
- [Share a trial](#-share-a-trial)
- [Model notes](#-model-notes)

## 👥 Roles

Add focused roles to your project's AI tool. Installation is explicit; workflows can also use the host's available agents.

| Role | Responsibility |
| --- | --- |
| [Exploration](../cli/assets/agents/explorer.md) | Answer scoped codebase questions with source references. |
| [Implementation](../cli/assets/agents/executor.md) | Deliver simple code or documentation with minimal changes and verification evidence. |
| [Validation](../cli/assets/agents/validator.md) | Confirm the requested outcome and acceptance criteria hold. |
| [Review](../cli/assets/agents/reviewer.md) | Find quality gaps, contradictions, duplication, and unnecessary complexity. |

**Scope and delegation:** see the [Project Memory AGENTS.md template](../plugins/aidd-context/skills/02-project-memory/assets/templates/AGENTS.md#agents).

## 🧠 Models and IDEs

[agent-models.json](../cli/src/contexts/tools/domain/formats/agent-models.json) assigns every role a `standard` or `light` profile. Each provider defines the profiles' model and effort. Main and review share `standard`; the `main` role is advisory and installation leaves the main session configuration unchanged.

## 📦 Install

The CLI command is unreleased. Build the `feature/sub-agents` checkout from the framework root:

```sh
pnpm --dir cli install --frozen-lockfile
pnpm --dir cli build
```

From the target project's root, install with a supported provider and IDE:

```sh
node /absolute/path/to/framework/cli/dist/cli.js agents install --provider openai --ide codex
```

Installation writes four self-contained native files and the ownership registry at `.aidd/agents.json`.

## 🧪 Try a small task

Use a disposable project or clean branch with explicit success criteria. Open a fresh host session after installation.

1. **Load:** confirm the installed roles are available; record the loaded definition's path and configured model and effort.
2. **Explore:** delegate one read-only codebase question; check the answer's source references and confirm a separate agent ran.
3. **Implement:** delegate one small code or documentation change with owned files and a check; inspect the diff and results.
4. **Verify:** request independent validation against the criteria and review of quality and coherence.

Use host dispatch records to identify the agent and actual model, effort, and tier where exposed. Headers and agent self-reports alone do not prove runtime selection; mark unavailable evidence **unverified**.

## 🔄 Update or remove

After updating the CLI, rerun the install command to refresh unmodified agents. Plugins and `sync` do not install or refresh this add-on. For framework development, `make reload` installs the agents globally for Claude Code (Anthropic), Codex (OpenAI), and OpenCode (`OPENCODE_AGENT_PROVIDER`, default `anthropic`), overwriting same-named global agent files.

To remove only one IDE's agents from the current project:

```sh
node /absolute/path/to/framework/cli/dist/cli.js agents remove --ide codex
```

The other IDEs' agents remain installed. Installation and removal refuse changes to personal or modified agent files. `aidd clean` retires the entire AIDD project installation, including all managed agents.

## 🚧 Beta limitations

- **Runtime selection:** verify the host actually uses the configured model and effort during your trial.
- **Interrupted command:** inspect the native files and registry before clearing `.aidd/agents.json.lock`; confirm no installation or removal is still running. Handled write failures restore the previous agent files.

## 📝 Share a trial

Copy one report per trial:

```markdown
- **IDE/version:**
- **CLI version/commit:**
- **Provider:**
- **Task and success criteria:**
- **Observed source/dispatch/model/effort/tier:**
- **Result:** passed / failed / unverified
- **Evidence:** host records, relevant diff, check command and result
```

## 💡 Model notes

Mistral is supported on OpenCode; its documented reasoning levels are `none` and `high`. [Mistral Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) uses the API ID `mistral-small-2603`, checked 2026-10-16.

Codex Fast supports Luna where available, but agents inherit the root session's service tier. Enable it with `/fast` in the parent session; agent installation does not change that setting. Fast consumes more usage. [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed), [subagent inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema), checked 2026-10-16.

Sources checked 2026-10-16: [OpenAI models](https://developers.openai.com/api/docs/models), [Claude models](https://platform.claude.com/docs/en/models/overview), [Mistral models](https://docs.mistral.ai/models), [Mistral Large 4 (public preview)](https://docs.mistral.ai/models/mistral-large-4-0), [Mistral reasoning](https://docs.mistral.ai/studio/conversations/reasoning), [OpenCode V2 variants](https://opencode.ai/v2/docs/models#variants), [Copilot model IDs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#supported-models). These recommendations are not a comparative benchmark or proof of account access.
