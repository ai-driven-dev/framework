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

Add focused roles to your project's AI tool. Installation is explicit.

| Role | Responsibility |
| --- | --- |
| [Exploration](../cli/assets/agents/explorer.md) | Answer scoped codebase questions with source references. |
| [Implementation](../cli/assets/agents/executor.md) | Deliver simple code or documentation with minimal changes and verification evidence. |
| [Validation](../cli/assets/agents/validator.md) | Confirm the requested outcome and acceptance criteria hold. |
| [Review](../cli/assets/agents/reviewer.md) | Find quality gaps, contradictions, duplication, and unnecessary complexity. |

**Scope and delegation:** see the [Project Memory AGENTS.md template](../plugins/aidd-context/skills/02-project-memory/assets/templates/AGENTS.md#agents).

## 🧠 Models and IDEs

[agent-models.json](../cli/src/contexts/tools/domain/formats/agent-models.json) assigns each role a profile: `main` for the main session, `standard` for review, `light` for exploration, implementation, and validation. Each provider sets every profile's model and effort, for example Opus, Sonnet, and Haiku for Anthropic. Implementation and validation run on `light` to save cost; edit the role mapping to trade it for quality.

The main session stays as configured unless you add `--main`, which sets the provider's `main` model and keeps every other setting:

| IDE | File | Keys |
| --- | --- | --- |
| Claude Code | `.claude/settings.json` | `model`, `effortLevel` |
| Codex | `.codex/config.toml` | top-level `model`, `model_reasoning_effort`; a selected `profile` still wins, and project files load only for trusted projects |
| OpenCode | `opencode.json` | `model` only: the root model keeps no variant; refused when `opencode.jsonc` holds the settings |

Copilot and Cursor are left unchanged. AIDD records what it replaced in `.aidd/main-model.json` and restores it on removal; it refuses to overwrite a value you changed since, and refuses TOML it cannot edit line by line safely. Sources checked 2026-10-20: [Claude Code settings](https://code.claude.com/docs/en/settings), [Codex config](https://developers.openai.com/codex/config-reference), [OpenCode V2 models](https://opencode.ai/v2/docs/models#variants).

## 📦 Install

The CLI command is unreleased. Build a framework checkout from its root:

```sh
pnpm --dir cli install --frozen-lockfile
pnpm --dir cli build
```

From the target project's root, install with a supported provider and IDE:

```sh
node /absolute/path/to/framework/cli/dist/cli.js agents install --provider openai --ide codex
```

Installation writes four self-contained native files and the ownership registry at `.aidd/agents.json`. Add `--main` to also set the main session model. Add `--scope user` to install into the IDE's user configuration instead (Claude Code, Codex, and OpenCode), with the registry in AIDD's user configuration directory.

## 🧪 Try a small task

Use a disposable project or clean branch with explicit success criteria. Open a fresh host session after installation.

1. **Load:** confirm the installed roles are available; record the loaded definition's path and configured model and effort.
2. **Explore:** delegate one read-only codebase question; check the answer's source references and confirm a separate agent ran.
3. **Implement:** delegate one small code or documentation change with owned files and a check; inspect the diff and results.
4. **Verify:** request independent validation against the criteria and review of quality and coherence.

Use host dispatch records to identify the agent and actual model, effort, and tier where exposed. Headers and agent self-reports alone do not prove runtime selection; mark unavailable evidence **unverified**.

## 🔄 Update or remove

After updating the CLI, rerun the install command to refresh unmodified agents; agents of retired roles are removed. Plugins and `sync` do not install or refresh this add-on.

For framework development, copy [reload-agents.example.json](../scripts/reload-agents.example.json) beside it as the gitignored `reload-agents.json` (or point `RELOAD_AGENTS` at another file). `make reload` then runs `agents install --scope user` for each listed IDE with its `provider`, adding `--main` where `"main": true`. Without the file, reload installs no agent. The file only adds: to undo an IDE or its main model, run `agents remove --scope user --ide <ide>`. Reload stops on a modified or unowned agent file; move it aside, then rerun.

To remove only one IDE's agents from the current project:

```sh
node /absolute/path/to/framework/cli/dist/cli.js agents remove --ide codex
```

The other IDEs' agents remain installed; add `--scope user` for user-level agents. Removal also restores the main model it replaced. Installation and removal refuse changes to personal or modified agent files. `aidd clean` retires the entire AIDD project installation, including its managed agents; user-level agents stay until `agents remove --scope user`.

## 🚧 Beta limitations

- **Runtime selection:** verify the host actually uses the configured model and effort during your trial.
- **Interrupted command:** inspect the native files and registry before clearing `.aidd/agents.json.lock`; confirm no installation or removal is still running. Handled write failures restore the previous agent files, settings, and registries.

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

Mistral is supported on OpenCode; its documented reasoning levels are `none` and `high`. Review and light roles use the `mistral-medium-latest` and `mistral-small-latest` aliases, which resolved to Medium 3.5 and [Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) on 2026-10-20, so they follow Mistral's updates. The main session pins [`mistral-large-4`](https://docs.mistral.ai/models/mistral-large-4-0) (public preview): `mistral-large-latest` still resolved to Large 3, without reasoning levels, in OpenCode's model list on 2026-10-20. Medium 3.5 is also a public preview.

Codex Fast supports Luna where available, but agents inherit the root session's service tier. Enable it with `/fast` in the parent session; agent installation does not change that setting. Fast consumes more usage. [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed), [subagent inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema), checked 2026-10-16.

Sources checked 2026-10-16, Mistral and Claude Sonnet 2026-10-20: [OpenAI models](https://developers.openai.com/api/docs/models), [Claude models](https://platform.claude.com/docs/en/models/overview), [Mistral models](https://docs.mistral.ai/models), [Mistral Medium 3.5 (public preview)](https://mistral.ai/news/vibe-remote-agents-mistral-medium-3-5), [Mistral reasoning](https://docs.mistral.ai/studio/conversations/reasoning), [OpenCode V2 variants](https://opencode.ai/v2/docs/models#variants), [Copilot model IDs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#supported-models). These recommendations are not a comparative benchmark or proof of account access.
