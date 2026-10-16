# Optional agents

Install agents in the current project with a provider and IDE:

```sh
aidd agents install --provider openai --ide codex
aidd agents install --provider anthropic --ide claude-code
aidd agents install --provider mistral --ide opencode
aidd agents remove --ide codex
```

The [CLI model configuration](../cli/src/contexts/tools/domain/formats/agent-models.json) defines `main` recommendations and applied `subagent` headers. Installing agents leaves the main model unchanged. Mistral is supported on OpenCode; its documented reasoning levels are `none` and `high`.

Each agent is one self-contained native file. Plugins and `make reload` do not install these optional agents; workflows delegate by responsibility using available host agents.

Sources checked 2026-10-16: [OpenAI models](https://developers.openai.com/api/docs/models), [Claude models](https://platform.claude.com/docs/en/models/overview), [Mistral models](https://docs.mistral.ai/models), [Mistral reasoning](https://docs.mistral.ai/studio/conversations/reasoning), [OpenCode V2 variants](https://opencode.ai/v2/docs/models#variants). These recommendations are not a comparative benchmark or proof of account access.
