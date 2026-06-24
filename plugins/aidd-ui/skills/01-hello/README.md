← [aidd-ui](../../README.md)

# hello

Smoke-test skill for the alpha `aidd-ui` plugin. It greets the caller and confirms the plugin loaded.

## When to use

- To verify the alpha `aidd-ui` plugin is installed and reachable after a local install or reload.

## When NOT to use

- For real UI or UX design, review, or improvement work. Those skills do not exist yet.

## How to invoke

`aidd-ui:01-hello`

## Outputs

- A short greeting printed in the chat.

## Prerequisites

- The plugin loaded locally (`claude --plugin-dir plugins/aidd-ui`, or installed from the marketplace).

## Technical details

See [SKILL.md](SKILL.md).
