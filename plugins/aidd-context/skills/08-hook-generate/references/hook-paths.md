# Hook paths

Where the script goes, and which path forms a handler command may use.

| Write mode | Script goes in |
| --- | --- |
| Host project | a `hooks/` dir beside the config by default, or another dir the user names |
| Plugin source | `plugins/<plugin>/hooks/scripts/` |

| Form | Meaning | Use for |
| --- | --- | --- |
| `CLAUDE_PROJECT_DIR`, written as `${VAR}` | the project root | Claude Code only |
| `CLAUDE_PLUGIN_DATA`, written as `${VAR}` | the plugin data dir | Claude Code only |
| `CLAUDE_PLUGIN` + `_ROOT`, written as `${VAR}` | the plugin install dir | Claude Code only |
| absolute path under the workspace | a fixed location | any tool, or the path the user names |
| relative path | not allowed | a hook command runs from an arbitrary cwd |
