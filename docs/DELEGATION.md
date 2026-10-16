# Optional agents

Install agents in the current project with a provider and IDE:

```sh
aidd agents install --provider openai --ide codex
aidd agents install --provider anthropic --ide claude-code
aidd agents install --provider mistral --ide opencode
aidd agents remove --ide codex
```

The [CLI model configuration](../cli/src/contexts/tools/domain/formats/agent-models.json) defines `main` recommendations and applied `subagent` headers. Installing agents leaves the main model unchanged. Mistral is supported on OpenCode; its documented reasoning levels are `none` and `high`.

Installation writes project-local agent files and `.aidd/agents.json`. After updating the CLI, rerun the same install command to refresh unmodified agents; `sync` and `make reload` do not refresh them.

Each agent is one self-contained native file. Plugins and `make reload` do not install these optional agents; workflows delegate by responsibility using available host agents.

Codex Fast supports Luna where available, but agents inherit the root session's service tier. Enable it with `/fast` in the parent session; agent installation does not change that setting. Fast consumes more usage. [Speed](https://learn.chatgpt.com/docs/agent-configuration/speed), [subagent inheritance](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema), checked 2026-10-16.

Sources checked 2026-10-16: [OpenAI models](https://developers.openai.com/api/docs/models), [Claude models](https://platform.claude.com/docs/en/models/overview), [Mistral models](https://docs.mistral.ai/models), [Mistral Large 4 (public preview)](https://docs.mistral.ai/models/mistral-large-4-0), [Mistral reasoning](https://docs.mistral.ai/studio/conversations/reasoning), [OpenCode V2 variants](https://opencode.ai/v2/docs/models#variants). These recommendations are not a comparative benchmark or proof of account access.
