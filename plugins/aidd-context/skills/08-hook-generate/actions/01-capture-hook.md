# 01 - Capture hook

Clarify what fires, on what, where it goes, and for which tools before touching a file.

## Input

A free-form request to add a hook.

## Output

In-context decisions, nothing written yet:

- the lifecycle moment the hook targets
- the action it runs, and whether it needs a backing script
- the matcher, or none for every occurrence
- the scope to install into, for declarative targets only
- the confirmed tools, and any skipped with a reason
- the write mode for declarative targets: a host project, or a plugin source
- a before-state of the project tree for guidance-only requests

## Process

1. **Gate.** Run the asset-access precheck ([tool-paths.md](../references/tool-paths.md)). For a guidance-only request, record the project tree's paths and file bytes before continuing, so action 03 can check that no file was written.
2. **Tools.** Detect the installed tools and confirm which to target ([tool-paths.md](../references/tool-paths.md)). OpenCode and Kilo are plugin-guidance targets, not declarative write targets. Skip tools without a documented applicable capability with a reason.
3. **Moment.** Pick the narrowest lifecycle moment that fits ([hook-authoring.md](../references/hook-authoring.md)).
   - For every target, confirm the event and required timing, matcher, payload, and blocking properties from its documentation ([hook-authoring.md](../references/hook-authoring.md), [tool-paths.md](../references/tool-paths.md)). Do not treat a nearby event as equivalent. If equivalence is unproved, skip publication for that target and explain why. Offer a behaviorally different moment only with its differences and explicit confirmation. Plugin-only targets receive sourced guidance only for a documented typed hook or event; otherwise say unsupported, with no invented fallback.
4. **Action.** Decide what runs at the moment, and whether it needs a backing script ([hook-authoring.md](../references/hook-authoring.md)).
5. **Matcher.** Set a matcher only when the moment must be filtered. Prefer a precise filter ([hook-authoring.md](../references/hook-authoring.md)).
6. **Scope.** For declarative targets, ask the user where to install: a single agent or skill component, the shared project, the project local-only, or the user's global config. Offer only the scopes those tools support ([tool-paths.md](../references/tool-paths.md)). Plugin guidance names documented paths without choosing or writing one.
   - For a component scope, name the exact skill or agent file, and confirm the moment fits a component-scoped hook ([tool-paths.md](../references/tool-paths.md)).
   - For declarative targets, state the resolved file and confirm. Never pick silently.
7. **Write mode.** For declarative targets, choose host project or plugin source. For a plugin source, name the plugin. Guidance-only targets have no write mode.
8. **Plugin guidance.** For each selected plugin-only tool, return terminal guidance stating its documented JS/TS plugin paths, the documented event or unsupported limit, the official source, and that no files are generated for that tool. Carry the guidance to actions 02 and 03, including in a mixed request.

## Test

- Every applicable decision is stated and confirmed in writing.
- Each declarative target's resolved scope and file are named before any write; guidance-only targets require neither.
- Each tool has a documented equivalent event and required properties, or its publication is skipped with a reason. A merely nearby event is not substituted.
- OpenCode-only and Kilo-only guidance name their sources and leave the complete project tree unchanged.
