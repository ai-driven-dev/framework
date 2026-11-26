# Publish AIDD marketplaces with each release

## Target

Users can install and update released AIDD plugins through the documented public distribution URL for their tool.

## Hard constraints

- A single public AIDD distribution repository hosts the catalogs. Every supported client gets a stable installation URL and version pinning where available.
- Hosted catalogs, release ZIPs, and flat-file distributions come from the same release. Existing ZIPs remain available from GitHub Releases.
- Each supported catalog publishes automatically. A failure is visible by tool and does not block other catalog publications.
- Cursor and Antigravity are not hosted: no client can install their catalog from a Git ref in an automated check. `notHosted` of `scripts/marketplace-distribution.json` lists them; `docs/INSTALL.md` states why.
- The release pins no model for any agent.
- A tool's stable branch moves only after its immutable version tag is verified with the real client. Deployment memory states the consequence.

## Non-goals

- Submission to vendor-curated directories.

## Done-when

- Each supported marketplace URL installs the expected release in the actual client and is documented with prerequisites, commands, and version support. CI exercises each flow the client allows it to automate.
- Compatibility documentation identifies each available format and explains the evidence or client limitations for unavailable marketplace flows.

## Open Questions

None. Cursor pinning and the settings required for Claude Code migration are verification outcomes.

## Context

[Approved brainstorm](brainstorm.md)
