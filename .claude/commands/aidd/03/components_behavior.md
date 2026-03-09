---
name: 'aidd:03:components_behavior'
description: 'Define the expected behavior of frontend components into a state machine format.'
argument-hint: 'names of the components to define behavior for.'
---

# Goal

Define the expected behavior of the following frontend components into a state machine format:

```text
$ARGUMENTS
```

## Rules

- Use a state machine format to define the behavior of each component.
- Each state should represent a distinct condition or mode of the component.
- Transitions between states should be triggered by specific events or user actions.
- Include conditions for each transition if applicable.
- Ensure that the state machine captures all possible states and transitions for the component's behavior.
- Use Mermaid syntax for state machine representation.

### Mermaid rules

```markdown
@.claude/rules/01-standards/1-mermaid.md
```

## Steps

Iterate over those steps until the behavior is fully defined.

1. Parse the user's initial request to extract the list of components.
2. For each component:
   1. Identify the key states the component can be in.
   2. Determine the events or actions that trigger transitions between these states.
   3. Define the state machine using a clear and structured format (e.g., Mermaid syntax).
3. Review the state machine to ensure it captures all possible behaviors of the component.
4. Present the final state machine definitions to the user for validation.
