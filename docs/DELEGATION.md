# Sub-agent models

The CLI's [model configuration](../cli/src/contexts/tools/domain/formats/agent-models.json) defines provider defaults and native fields for the four AIDD agents.

Installation and translation write supported settings into native agent files. Explicit agent settings take precedence. Other agents keep their own settings.

Agent behavior and skills stay independent of model selection. Hosts load the installed configuration when opening a session; model availability depends on the account.

Codex and Cursor require their flat native agent files for these settings: Codex does not discover agents staged inside a plugin, and Cursor plugin agents inherit their model.
