# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | Marketplace only | ✅ |
| Antigravity CLI | `.agents/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Marketplace only | Supported when installed through the tool's marketplace, not as flat files |
| Some events | Only `SessionStart`, `Stop` and `PostToolUse` |

## Hosted marketplaces

The compatibility table describes the formats AIDD generates. Hosted installation depends on the client and the release channel. The [installation guide](INSTALL.md#marketplace) lists the public URLs, commands, and local ZIP alternatives.

- Claude Code, Codex, and GitHub Copilot CLI can add a Git catalog and select a release ref. [Claude Code](https://code.claude.com/docs/en/plugins/host-marketplace) · [Codex](https://developers.openai.com/plugins/build/plugins) · [Copilot CLI](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- Cursor documents organization-managed catalog imports on Teams and Enterprise. Installation from AIDD’s hosted catalog in the team client is pending verification. The marketplace ZIP supports the local plugin workflow. [Cursor](https://cursor.com/docs/plugins)
- OpenCode supports packages from npm or Git. AIDD generates an OpenCode flat-file distribution. [OpenCode](https://opencode.ai/docs/plugins/)
- Kilo’s official marketplace accepts contributions through its catalog repository. AIDD generates a Kilo flat-file distribution. [Kilo](https://kilo.ai/docs/customize/marketplace#contributing)
- Antigravity CLI has its own marketplace and accepts direct Git plugin installs. AIDD generates an Antigravity flat-file distribution. [Antigravity marketplace](https://antigravity.google/docs/marketplace/) · [Antigravity skills and plugins](https://antigravity.google/docs/skills)
