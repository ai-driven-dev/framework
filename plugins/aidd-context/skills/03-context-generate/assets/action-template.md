# <NN — Action title>

<One-line description of what this action does.>

## Inputs

- `<name>` (required) — <type, one-line description>
- `<name>` (optional, default: `<value>`) — <type, one-line description>

## Outputs

<Example of the concrete artifact produced. A code block, a table, or a short JSON shape. Keep it short and real.>

```
<example here>
```

## Depends on

<Optional. Remove this section if the action is standalone. List upstream slugs only.>

- `<NN-slug>`

## Process

1. <Imperative step. Reference MCP tools by qualified name, e.g. `mcp__slack__slack_post_message`.>
2. <Next step.>
3. <Branching allowed: "If X, do A; otherwise do B.">

## Test

<Prefer a JS script. Fall back to MCP runbook or LLM assertion only if a script is impossible.>

**Pattern A — JS script (preferred):**
```bash
node scripts/test-<slug>.js
```

**Pattern B — MCP runbook:**
Call `mcp__<server>__<tool>` with `param1=<value>`. Verify the response satisfies `<concrete condition>`.

**Pattern C — LLM assertion with example:**
Assert: "<concrete assertion>". Example of a correct output:
```
<concrete example that passes the assertion>
```
