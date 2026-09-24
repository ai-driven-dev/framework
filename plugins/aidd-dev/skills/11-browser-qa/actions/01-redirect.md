# 01 - Redirect

Answer a direct invocation with where browser QA moved, and stop.

## Input

None.

## Output

A migration message naming the `aidd-qa` plugin and its install command. No QA scope is loaded, no scenario runs, and no evidence is recorded.

## Process

1. **Print.** Emit: "Browser QA moved to the `aidd-qa` plugin. Install it with `/plugin install aidd-qa@aidd-framework` (or `aidd plugin install aidd-qa`), then run its acceptance QA skill."
2. **Stop.** Never load a scope, run a scenario, or write evidence.

## Test

- The message names the `aidd-qa` plugin and a working install command.
- No scenario, fixture, or recording step runs after the message.
