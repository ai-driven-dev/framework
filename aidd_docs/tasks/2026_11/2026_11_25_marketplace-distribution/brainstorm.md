---
status: approved
---

# Distribute AIDD marketplaces with each release

Users install and update a released version of AIDD from the documented distribution URL for their tool.

## Decisions

- A single public AIDD distribution repository hosts the catalogs, with a stable URL per tool and version refs where the client supports them. `framework` remains the development repository. Claude Code, Codex, GitHub Copilot, and Cursor are the first installation flows to verify. [Claude Code documentation](https://code.claude.com/docs/en/plugins/host-marketplace) · [Codex documentation](https://developers.openai.com/plugins/build/plugins) · [Copilot documentation](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/create-and-share-plugin-marketplaces) · [Cursor documentation](https://cursor.com/docs/plugins)
- Hosted catalogs, ZIP archives, and flat-file distributions come from the same versioned sources and reuse the existing `build-per-tool` generation. ZIP archives remain available in GitHub Releases. `docs/COMPATIBILITY.md` lists the available formats for tools without a verified marketplace installation flow.
- CI publishes each supported catalog automatically at release time. It reports failures by tool and lets the other publications proceed. CI and the documentation use the same installation URLs. CI checks ZIP availability and, where the client permits, installs from the public URL in a clean profile and verifies the installed version. Any flow requiring manual steps is verified in the actual client before it is documented as supported.
- For two releases, the Claude Code catalog at the old URL, `aidd-framework`, receives the same versions as the new catalog. The documentation recommends the new URL starting with the first release. The new catalog uses a distinct name so both can be registered during the transition. Verify migration from an existing installation with user and project settings before documenting how to install at the same scopes, carry over the required settings, and remove the old catalog. After the transition, the old URL continues to serve the final transition release. [Claude Code marketplace management](https://code.claude.com/docs/en/plugins/create-marketplace#host-your-marketplace)
- The documentation lists each tool’s URLs, installation commands or steps, prerequisites, and available formats. Submissions to official directories help users discover AIDD and follow each vendor’s review timeline. AIDD-hosted distribution follows the release schedule.

## Open points

- Cursor documents marketplace imports for Teams and Enterprise. Verify whether the client can import a specific branch or tag before documenting version pinning. [Cursor marketplace imports](https://cursor.com/docs/plugins)
- Verify which Claude Code settings need to carry over when switching catalogs and that users can still update from the old URL during the overlap.
- If agents get default models, use the same selection per tool and provider across the formats that can express it. The model and version choices are still open.
