# Optional agents

Install agents in the current project with a provider and IDE:

```sh
aidd agents install --provider openai --ide codex
aidd agents install --provider anthropic --ide claude-code
aidd agents remove --ide codex
```

The CLI writes native agents using its [model configuration](../cli/src/contexts/tools/domain/formats/agent-models.json). Plugins do not install these agents.
