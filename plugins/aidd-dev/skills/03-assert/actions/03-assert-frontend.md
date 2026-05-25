# 03 - Assert Frontend

Iterate until a frontend feature works as intended by inspecting the running UI, mapping the behavior to the code, and tracking attempts in a task template.

## Inputs

```yaml
expected_behavior: <free-form description, passed via $ARGUMENTS>
url: <entry URL>                       # required; the frontend must already be running
```

## Outputs

```yaml
task_template_path: <path where the filled template was written>
iterations: <int>
fixed: true|false
report:
  - { iteration: <int>, hypothesis: <one-line>, fix_attempted: <one-line>, validated: pass|fail }
```

## Process

Iterate over the steps below until the feature works as intended.

1. **Parse the request.** Extract expected requirements (visual, functional, technical) from `expected_behavior`. Summarize and list action paths (e.g. user clicks button -> calls function in file1 -> updates state in file2).
2. **Inspect the running app.** Open the URL via the configured browsing tool. Inspect the page visually and technically. Take screenshots to confirm the issue.
3. **Locate the code.** Explore the codebase to find the files and snippets related to the issue.
4. **Fill the tracking template** from `@${CLAUDE_PLUGIN_ROOT}/skills/03-assert/assets/task-template.md`. List the three best potential causes with a short description and confidence level.
5. **Fix-loop.**
   - Take the first potential cause.
   - Apply a candidate fix.
   - Validate against the expected behavior.
   - If not fixed, mark the cause and move to the next.
   - When the three causes are exhausted, re-evaluate, add three new causes to the template, and repeat from step 5.
6. **Boundaries.** Assume all servers are already running. Minor visual discrepancies (1-2 px differences, slight color variations) are acceptable unless explicitly specified in the initial request. Screenshots MUST be used to validate UI changes.

## Test

The task template file exists and is updated for every iteration; the final entry in `report` has `validated: pass`; the running URL renders the expected behavior, confirmed by a screenshot recorded after the final iteration.
