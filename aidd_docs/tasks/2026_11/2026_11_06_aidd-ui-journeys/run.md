# Run: aidd-ui journeys and wireframes

## Run 1

- Head: `4e8c0492c`
- Left: differs from the plan in one point: `bump --change` raises a wireframe or a journey only when it is named, never through a component it expects, and the impact report leaves wireframe renders out, since they hold no token. Each guard of the run had its mutation killed.

| Task | Validation | Result |
| ---- | ---------- | ------ |
| 1.1 | wireframe kind, R2, R3, R7: wrapped suite, records.test.js | pass |
| 1.2 | R12 screen or wireframe, action but on the last step, `## Persona`: records.test.js | pass |
| 1.3 | R18 warning for a missing component, its own message for a record that is no component: records.test.js | pass |
| 1.4 | V1, V2 states and zones, V10 style only outside comments: tokens-renders.test.js | pass |
| 1.5 | impact `wireframes`, bump of a named wireframe or journey: impact.test.js, bump.test.js | pass |
| 1.6 | mutations of every guard of the phase, each turning its own test red | 28 killed, 0 survived |
| 2.1 | templates filled and validated, proposed at version 1: skill.test.js | pass |
| 2.2 | skill names no other skill, no date, no em-dash, no link outside it: skill.test.js | pass |
| 2.3 | manifest and folder hold both skills: skill.test.js | pass |
| 2.4 | 01-system proposes brand and tokens first: skill.test.js | pass |
| 3.1 | README and global spec name wireframes and the persona section | done |
| 3.2 | `claude -p --model haiku` on a blank breathing app, Gouvernail and Kairos copies, twice for the blank app and Kairos | journeys with a wireframe per step, `validate` left with T1 only, owed by the design system |
| 3.3 | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`, pre-commit | 1525 pass, 0 fail; pre-commit green |
