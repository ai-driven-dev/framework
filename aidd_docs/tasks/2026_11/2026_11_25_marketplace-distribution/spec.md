# Publish AIDD marketplaces with each release

## Target

Users can install and update released AIDD plugins through the documented public distribution URL for their tool.

## Hard constraints

- A single public AIDD distribution repository hosts the catalogs. Every supported client gets a stable installation URL and version pinning where available.
- Hosted catalogs, release ZIPs, and flat-file distributions come from the same release. Existing ZIPs remain available from GitHub Releases.
- Each supported catalog publishes automatically. A failure is visible by tool and does not block other catalog publications.
- The legacy Claude Code marketplace receives the same versions for two releases. Its URL continues to serve the final transition release. The new catalog has a distinct name and is the documented entry point from the first release.

## Non-goals

- Submission to vendor-curated directories and selection of default models for agents.

## Done-when

- Each supported marketplace URL installs the expected release in the actual client and is documented with prerequisites, commands, and version support. CI exercises each flow the client allows it to automate.
- A legacy Claude Code installation can update during the overlap and migrate to the new catalog with documented instructions for user and project settings.
- Compatibility documentation identifies each available format and explains the evidence or client limitations for unavailable marketplace flows.

## Open Questions

None. Cursor pinning and the settings required for Claude Code migration are verification outcomes.

## Context

[Approved brainstorm](brainstorm.md) · [Issue #1165](https://github.com/ai-driven-dev/framework/issues/1165)
