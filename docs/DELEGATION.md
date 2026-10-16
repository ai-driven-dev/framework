# Optional agents (beta)

Custom agents are an explicit opt-in. Workflows delegate by responsibility using available host agents; plugins work without this add-on.

## Install, update, remove

The CLI command is unreleased. Build the `feature/sub-agents` checkout from the framework root:

```sh
pnpm --dir cli install --frozen-lockfile
pnpm --dir cli build
```

From the target project's root, use the built CLI instead of a published `aidd`:

```sh
node /absolute/path/to/framework/cli/dist/cli.js agents install --provider openai --ide codex
node /absolute/path/to/framework/cli/dist/cli.js agents remove --ide codex
```

Choose the provider and IDE from the [CLI model configuration](../cli/src/contexts/tools/domain/formats/agent-models.json). It defines `main` recommendations and applied `subagent` headers. Installing agents leaves the main model unchanged. Mistral is supported on OpenCode; its documented reasoning levels are `none` and `high`.

Installation writes project-local agent files and `.aidd/agents.json`. After updating the CLI, rerun the same install command to refresh unmodified agents; `sync` and `make reload` do not refresh them.

Each agent is one self-contained native file. Installation and removal refuse to overwrite or delete modified agents. Plugins and `make reload` do not install these optional agents.

## Native execution trial

Run in a disposable project or clean branch with a small task and explicit success criteria:

1. **Load.** Open a fresh host session in the target project. Confirm it exposes the installed native roles; record the loaded definition's path and generated model and effort settings.
2. **Explore.** Ask for a delegated, read-only answer to one scoped codebase question, with file references. Confirm a separate agent actually ran.
3. **Implement.** Delegate one small code or documentation change with owned files and a check. Inspect the resulting diff and check evidence.
4. **Verify.** Request separate validation against the criteria and review for quality, coherence, and unnecessary changes.

Capture host dispatch records and actual model, effort, and tier metadata where exposed. Generated headers and the agent's own claims do not establish runtime selection. Mark unavailable metadata **unverified**.

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

## Model notes

Codex Fast supports Luna where available, but agents inherit the root session's service tier. Enable it with `/fast` in the parent session; agent installation does not change that setting. Fast consumes more usage. [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed), [subagent inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema), checked 2026-10-16.

Sources checked 2026-10-16: [OpenAI models](https://developers.openai.com/api/docs/models), [Claude models](https://platform.claude.com/docs/en/models/overview), [Mistral models](https://docs.mistral.ai/models), [Mistral Large 4 (public preview)](https://docs.mistral.ai/models/mistral-large-4-0), [Mistral reasoning](https://docs.mistral.ai/studio/conversations/reasoning), [OpenCode V2 variants](https://opencode.ai/v2/docs/models#variants). These recommendations are not a comparative benchmark or proof of account access.
