# SA-01: Pre-flight and initialize tracking

Last interactive step. Validates prerequisites, builds journey map, creates tracking file, spawns first autonomous agent.

## Instructions

### Resume flow (existing task)

1. Check `{{DOCS}}/tasks/` for files matching the task name:
   - `*.in-progress.md` → Report status (iteration, steps remaining), spawn (step 10) to resume.
   - `*.done.md` → Report "Task already completed." Stop.
   - No file → continue to step 2.

### New task flow

2. **Collect** from user: task name, description, success condition, rules.

3. **Research approach.** Before planning steps, read the relevant documentation (README, docs, official guides). Identify the recommended method. Do not default to what you already know — use what the source recommends.

4. **Validate goal.** "Could I execute this with zero ambiguity?" If NO → ask to reformulate. Examples:
   - "Make the code better" → Reject. "What metric?"
   - "All tests pass after `npm test`" → Accept.

5. **Validate success condition.** Must be a runnable command. Ask: "What command proves this is done?" Examples:
   - `npm test exits 0` → Valid.
   - "The code is clean" → Invalid. → `eslint . exits 0`.

6. **Pre-flight checklist.** For each step, verify: tools, secrets, API access, data, permissions. The agent will handle everything autonomously — just identify what's needed.

   ```
   [✓] Node.js v20 installed
   [✓] npm test configured in package.json
   [?] Stripe API key — agent will generate via dashboard
   [?] Database password — ask user now if only they know it
   ```

7. **Build ASCII journey map.** Project entire path. Show steps, dependencies, tools, blockers. Ask user to confirm.

   ```
   ┌─────────────────────────────────────────────────┐
   │  FOR SURE: fix-auth-tests                       │
   │  Goal: npm test exits 0 AND coverage > 80%      │
   ├─────────────────────────────────────────────────┤
   │                                                  │
   │  [1] Setup test environment                      │
   │   └─ needs: node, jest, .env with DB_URL         │
   │       │                                          │
   │  [2] Fix failing login test                      │
   │   └─ needs: access to auth service API           │
   │       │                                          │
   │  [3] Fix token refresh test                      │
   │   └─ needs: API key (SOFT — agent generates)     │
   │       │                                          │
   │  [4] Add coverage for edge cases                 │
   │   └─ needs: test data from step 2                │
   │       │                                          │
   │  [✓] SUCCESS: npm test exits 0 AND               │
   │      coverage > 80%                              │
   │                                                  │
   │  Agent handles: API key gen via dashboard          │
   └─────────────────────────────────────────────────┘
   ```

   Iterate until user confirms: "Does this map look correct? Anything missing?"

8. Read `../../01-plan/assets/plan-template.md`. Create `{{DOCS}}/tasks/` if needed.

9. Create `{{DOCS}}/tasks/<task-name>.in-progress.md` using the plan template. Fill frontmatter (`objective`, `success_condition`, `iteration: 0`, `created_at`), Phases with Tasks and Acceptance criteria (= the steps), and include the journey map.

### Spawn

10. Read the **Prompt** section of `actions/03-autonomous-loop.md`. Pass it to the Agent tool with `<task-name>` filled in.

## Input / Output

- **Input**: User's task description, or existing task file.
- **Output**: `{ tracking_file: "{{DOCS}}/tasks/<task-name>.in-progress.md" }`

## References

Read `../../01-plan/assets/plan-template.md` for file format. Acceptance criteria checkboxes are the steps the autonomous loop ticks off; the `Log` section is append-only.

## Test policy

- **Assertion**: Task file exists as `.in-progress.md` AND `success_condition` is a runnable command AND journey map present AND autonomous agent spawned.
- **Exit condition**: Autonomous agent is running.
- **Expected result**: Path to `.in-progress.md`, loop started.
- **Retry loop**: Interactive — if unclear, ask again.
- **On failure**: Tell user what is missing.
