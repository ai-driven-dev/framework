# 04 - Apply recipe

Apply chosen recipe steps and report what remains for the human.

## Input

The recipe to apply, named by number from the latest `list`, slug, title, or topic.

## Output

A recipe analysis and, on the user's choice, completed steps with a report of remaining human steps.

## Process

1. **Locate.** Resolve and read the recipe with [recipe-locations.md](../references/recipe-locations.md).
2. **Analyse.** Classify each step as agent-doable or human-only and summarise the recipe's outcome and the agent's scope.
   - Agent-doable examples: a file edit or configuration change.
   - Human-only examples: a TUI command, an install, or anything requiring the user's terminal or UI.
3. **Ask.** Show the analysis and ask whether to run all agent-doable steps, a subset, or just report.
   - Never mutate before this answer.
4. **Execute.** Carry out the chosen agent-doable steps as a tracked todo list.
   - Pause for confirmation on any step that changes a file.
   - Leave human-only steps untouched.
5. **Report.** Report what was done, list the human-only steps as instructions for the user, and run any `## Verify` checks.

## Test

| Case | Pass |
| --- | --- |
| Recipe selected | Each step is classified and the user chooses what to run before any change |
| Numeric selection | It matches the latest list row; a missing current list is refreshed and the user selects again |
| Chosen agent-doable steps | They run as a tracked todo list, with confirmation before each file-changing step |
| Human-only steps | They are reported as instructions and never executed |
