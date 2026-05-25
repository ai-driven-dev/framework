# 02 - Components behavior

Define the expected behavior of one or more frontend components as state machines, rendered in Mermaid syntax for user validation.

## Inputs

```yaml
components: <list of component names, passed via $ARGUMENTS>
```

## Outputs

```yaml
state_machines:
  - component: <name>
    diagram: <mermaid block>
    states: [<state name>]
    transitions: [{ from: <state>, to: <state>, event: <text>, condition: <optional text> }]
```

## Process

Iterate over the steps below until each component is fully defined.

1. **Parse the request.** Extract the list of components from `$ARGUMENTS`.
2. **Per component**:
   - Identify the key states the component can be in.
   - Determine the events or actions that trigger transitions between states.
   - Define the state machine in Mermaid syntax, applying `@${CLAUDE_PLUGIN_ROOT}/skills/01-plan/references/mermaid-conventions.md`.
3. **Sanity-check the model.** Confirm the state machine captures every state and every transition relevant to the component's behavior.
4. **Present the final state machines** to the user for validation. Wait for an explicit OK before exiting.

## Test

For each component in `components`: the corresponding `state_machines` entry has a Mermaid block that parses, lists at least two states, and every transition references states that exist in the same diagram.
