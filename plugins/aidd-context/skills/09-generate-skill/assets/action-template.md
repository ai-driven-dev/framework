# <NN — Action title>

<One-line description of what this action does.>

## Inputs

- `<name>` (required) — <type, one-line description>
- `<name>` (optional, default: `<value>`) — <type, one-line description>

## Outputs

<Example of the concrete artifact produced. A code block, a table, or a short JSON shape.>

```
<example here>
```

## Depends on

<Optional. List upstream slugs only.>

- `<NN-slug>`

## Process

1. <Imperative step. Reference MCP tools by qualified name, e.g. `mcp__slack__slack_post_message`.>
2. <Next step.>

## Test

<One sentence describing how to verify this action's intent — a command to run, a concrete check on the produced artifact, or an observable side-effect (API/MCP/state). Examples:>

- `node scripts/<slug>.js` exits 0 with non-empty payload (real 200).
- `<artifact>` exists at `<path>` and satisfies `<concrete check>`.
- Call `mcp__<server>__<tool>` with `<concrete params>`, assert `<observable result>`.

**Never** a `*.test.js` mocking the call — the first successful run is the test.
