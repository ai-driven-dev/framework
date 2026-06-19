# 04 - Apply recipe

Execute an existing recipe against the current project by spawning an agent that works through its steps as a tracked todo list, confirming with the user.

## Input

The recipe to apply, named by slug or topic.

## Output

The recipe's steps carried out on the project, tracked as a todo list, ending with its `## Verify` checks run and reported.

## Process

1. **Locate.** Resolve the recipe to `recipes/<slug>.md` and read it. Run `list` first when the recipe is unnamed.
2. **Plan.** Turn each step under the recipe's steps heading (`## Steps to …`) into one todo entry.
3. **Confirm.** Show the user the plan and ask for confirmation before any change.
4. **Execute.** Spawn an agent via the `Task` tool to work the todo list in order. It marks each item done as it lands, and pauses for confirmation on any step that mutates the project.
5. **Verify.** Run the recipe's `## Verify` checks and report pass or fail.

## Test

- Applying a recipe produces a todo list mirroring the recipe's steps, asks for confirmation before executing, and runs the `## Verify` checks at the end.
