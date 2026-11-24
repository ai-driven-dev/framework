# OpenCode

- Surface. OpenCode 2.4 documents built-in automations. Check the running server exposes the automation tools and the project allows them. [Release notes](https://github.com/anomalyco/opencode/releases/tag/v2.4.0)
- Setup. Ask OpenCode to schedule the rendered prompt in the chosen project. The experimental API accepts a name, a project directory or session, an `at`, `every` or `cron` trigger with optional `tz`, and an action with `type: "prompt"` and the prompt text. Read the installed schema before building a payload. [API](https://opencode.ai/docs/api)
- Verify. Inspect the entry with `/automation` or read its ID through the automation API. Compare the saved prompt, directory, trigger, timezone, status and next due time. [API in Markdown](https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/core/src/plugin/skill/opencode/api/automation.md)
