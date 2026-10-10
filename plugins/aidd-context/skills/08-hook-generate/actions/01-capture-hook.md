# 01 - Capture hook

Clarify what fires, on what, where it goes, and for which tools before touching a file.

## Input

A free-form request to add a hook.

## Output

In-context decisions, nothing written yet:

- the lifecycle moment the hook targets
- the action it runs, and whether it needs a backing script
- the matcher, or none for every occurrence
- the scope to install into
- the confirmed tools, and any skipped with a reason
- the write mode: a host project, or a plugin source

## Process

1. **Gate.** Run the asset-access precheck ([tool-paths.md](../references/tool-paths.md)).
2. **Tools.** Detect the installed tools and confirm which to target ([tool-paths.md](../references/tool-paths.md)). Kilo is a terminal guidance target, not a declarative write target. Skip other unsupported tools with a reason.
3. **Moment.** Pick the narrowest lifecycle moment that fits ([hook-authoring.md](../references/hook-authoring.md)).
   - Confirm each declarative target exposes that moment ([tool-paths.md](../references/tool-paths.md)). For Kilo, give sourced plugin guidance only for a documented typed hook or event; otherwise say unsupported, with no invented fallback.
4. **Action.** Decide what runs at the moment, and whether it needs a backing script ([hook-authoring.md](../references/hook-authoring.md)).
5. **Matcher.** Set a matcher only when the moment must be filtered. Prefer a precise filter ([hook-authoring.md](../references/hook-authoring.md)).
6. **Scope.** For declarative targets, ask the user where to install: a single agent or skill component, the shared project, the project local-only, or the user's global config. Offer only the scopes those tools support ([tool-paths.md](../references/tool-paths.md)). Kilo guidance names the documented project plugin paths without choosing or writing one.
   - For a component scope, name the exact skill or agent file, and confirm the moment fits a component-scoped hook ([tool-paths.md](../references/tool-paths.md)).
   - State the resolved file and confirm. Never pick silently.
7. **Write mode.** Host project, or a plugin source. For a plugin source, name the plugin.
8. **Kilo result.** If Kilo is selected, return terminal guidance stating its JS/TS plugin paths, the documented event or unsupported limit, the official source and dates, and that no Kilo files were written. Kilo-only stops here. For a mixed request, carry that guidance into action 02 for the other confirmed tools.

## Test

- Every decision is stated and confirmed in writing.
- The resolved scope and file are named before any write.
- Each tool was confirmed to support the moment, or skipped with its reason.
- Kilo-only terminal guidance names the source and leaves the complete project tree unchanged.
