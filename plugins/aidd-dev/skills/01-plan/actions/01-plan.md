# 01 - Plan

Generate a technical implementation plan from requirements, save it to a task file, display it for review, and wait for explicit user confirmation. Never code anything.

## Inputs

```yaml
requirements: <ticket URL or raw text, passed via $ARGUMENTS>
ticket_number: <id>      # optional; inferred when the input is a ticket URL
```

## Outputs

```yaml
plan_path: aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>(-master|-part-N)?.md
plan_kind: simple | master
confidence: 0-10
architecture_projection:
  modify: [<path - one-line reason>]
  create: [<path - one-line reason>]
  delete: [<path - one-line reason>]
applicable_rules: [{ tool: <claude|cursor|copilot|opencode>, name: <id>, path: <rule path>, why: <one-line> }]
```

## Process

1. **Parse the input.** Detect ticket URL vs raw text. For URLs, fetch and parse ticket content. For raw text, clean and structure. Normalize text (handle vocal dictation issues). Print the user journey as a simplified ASCII diagram for validation.
2. **Score risk and impact.** Compute the score and pick the plan kind:
   - Score < 3 -> simple plan (`@${CLAUDE_PLUGIN_ROOT}/skills/01-plan/assets/plan-template.md`)
   - Score >= 3 -> master plan (`@${CLAUDE_PLUGIN_ROOT}/skills/01-plan/assets/master-plan-template.md` + child plans)
   
   | Criterion                       | Points |
   | ------------------------------- | ------ |
   | Breaking changes to public APIs | +3     |
   | Database / schema migrations    | +3     |
   | 3+ modules affected             | +2     |
   | 5+ modules affected             | +3     |
   | Major refactoring               | +2     |
   | External dependency upgrades    | +2     |
   
   Each part of the plan must be doable without the next ones (independent phases for compatibility).
3. **Validate technical assumptions** by spawning a sub-agent task to:
   - Explore the codebase to inform plan generation.
   - List implicit assumptions about the user's infrastructure.
   - Verify API feasibility before committing to an approach.
   - Flag blockers and risks that will arise if not addressed.
   - Check assumptions against official documentation.
   - Produce the architecture projection (three lists, each `path - one-line reason`): files to modify, files to create, files to delete.
   - Inventory project rules from the user's project root; accept a silent empty array when no surface contains rules.
4. **Architecture projection and rules - user validation (gate).**
   - From the rules inventory, select rules that apply to the projection using each rule's `description` and `paths` when present. Justify every selected rule in one line.
   - Display: the three modify / create / delete lists; the table of applicable rules `tool | name | path | why it applies`.
   - Ask: "Is this projection correct? Anything to add or remove? A missing rule?"
   - WAIT FOR USER APPROVAL. Iterate until approved.
5. **Task planning.** Define main phases at the macro level; do not mention specific files. Wait for user validation on the phases before moving on. For each phase, list minimal, specific, actionable tasks.
6. **Generate and save the plan.**
   - Use the current `!`date`!` for the date stamp.
   - Determine the feature name from the requirements.
   - Insert the user journey as Mermaid syntax in the plan (apply `@${CLAUDE_PLUGIN_ROOT}/skills/01-plan/references/mermaid-conventions.md`).
   - Fill the chosen template, including the validated architecture projection and applicable rules.
   - Fill execution frontmatter (required - the plan IS the For Sure tracking file): `objective`, `success_condition` (a runnable command; reject vague conditions), `iteration: 0`, `created_at` (ISO 8601 from step 1).
   - Save to disk:
     - Simple plan: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>.md`
     - Master plan: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>-master.md`
     - Child plans: `aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>-?<#ticket_number>-<feature_name>-part-N.md`
   - Display the saved file path.
7. **Quality assurance.** Verify the plan addresses every requirement; flag potential challenges; evaluate confidence (0-10) with ✓ reasons and ✗ risks; require minimum 9/10 before display; add the assessment to the plan.
8. **Display and confirm.** Show the plan, the confidence assessment, and any risks. Challenge the plan with the user. WAIT FOR USER APPROVAL.

## Test

The plan file exists at `plan_path`; its frontmatter contains `objective`, a runnable `success_condition`, `iteration: 0`, and a valid `created_at`; the architecture projection (M / C / D) is non-empty and matches the validated lists; the applicable rules table is consistent with the project's rules inventory; confidence is `>= 9`.
