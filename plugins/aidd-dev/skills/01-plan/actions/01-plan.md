# 01 - Plan

Generate a technical implementation plan from requirements, save it to a task file, display it for review, and wait for explicit user confirmation. Never code anything.

## Input

Requirements as a ticket URL or raw text, passed via `$ARGUMENTS`. The ticket number is optional and inferred when the input is a ticket URL. Optionally, a brainstorm artifact under `aidd_docs/brainstorm/` carrying settled decisions and flagged-open assumptions for the feature.

## Output

A plan file saved under `aidd_docs/tasks/<yyyy_mm>/`, named `<yyyy_mm_dd>-?<#ticket_number>-<feature_name>` with an optional `-master` or `-part-N` suffix. It carries execution frontmatter (`objective`, a runnable `success_condition`, `iteration: 0`, `created_at`), the validated architecture projection (files to modify, create, and delete, each with a one-line reason), the applicable-rules table, the source brainstorm path, and a confidence score.

## Process

1. **Parse the input.** Detect ticket URL vs raw text. For URLs, fetch and parse ticket content. For raw text, clean and structure. Normalize text (handle vocal dictation issues). Print the user journey as a simplified ASCII diagram for validation.
2. **Ingest the brainstorm, if any.** When a brainstorm artifact is passed, or one exists under `aidd_docs/brainstorm/` for this feature, read it. Treat its **settled** decisions as constraints the plan must honor. Hold its flagged-open assumptions as risks to carry. Record the artifact path for the plan's Brainstorm field. If no artifact exists, continue with `none`.
3. **Validate technical assumptions.** Spawn a sub-agent task to:
   - Explore the codebase to inform plan generation.
   - List implicit assumptions about the user's infrastructure.
   - Verify API feasibility before committing to an approach.
   - Flag blockers and risks that will arise if not addressed.
   - Check assumptions against official documentation.
   - Produce the architecture projection, three lists (files to modify, to create, to delete), each entry a path and a one-line reason.
   - Inventory project rules from the user's project root. Accept a silent empty array when no surface contains rules.
4. **Architecture projection and rules, user validation (gate).**
   - From the rules inventory, select rules that apply to the projection using each rule's `description` and `paths` when present. Justify every selected rule in one line.
   - Display the three modify, create, and delete lists, and the table of applicable rules `tool | name | path | why it applies`.
   - Surface any conflict between a settled brainstorm decision and this projection now, before generating, never silently diverge from it.
   - Ask: "Is this projection correct? Anything to add or remove? A missing rule?"
   - Wait for user approval. Iterate until approved.
5. **Task planning.** Define main phases at the macro level, without naming specific files. Wait for user validation on the phases before moving on. For each phase, list minimal, specific, actionable tasks.
6. **Generate and save the plan.**
   - Use the current `!`date`!` for the date stamp.
   - Determine the feature name from the requirements.
   - Insert the user journey as Mermaid syntax in the plan, applying `@../references/mermaid-conventions.md`.
   - Fill the chosen template with the validated architecture projection, applicable rules, and the brainstorm path (or `none`).
   - Fill execution frontmatter, required because the plan is the For Sure tracking file: `objective`, `success_condition` (a runnable command, reject vague conditions), `iteration: 0`, `created_at` (ISO 8601 from step 1).
   - Save to disk under `aidd_docs/tasks/<yyyy_mm>/`:
     - Simple plan: `<yyyy_mm_dd>-?<#ticket_number>-<feature_name>.md`
     - Master plan: `<yyyy_mm_dd>-?<#ticket_number>-<feature_name>-master.md`
     - Child plans: `<yyyy_mm_dd>-?<#ticket_number>-<feature_name>-part-N.md`
   - Display the saved file path.
7. **Quality assurance.** Verify the plan addresses every requirement and honors every settled brainstorm decision. Flag potential challenges. Evaluate confidence from 0 to 10 with ✓ reasons and ✗ risks. Require a minimum of 9 before display. Add the assessment to the plan.
8. **Display and confirm.** Show the plan, the confidence assessment, and any risks. Challenge the plan with the user. Wait for user approval.

## Test

- The plan file exists under `aidd_docs/tasks/<yyyy_mm>/` with the expected name.
- Its frontmatter carries `objective`, a runnable `success_condition`, `iteration: 0`, and a valid `created_at`.
- The architecture projection (modify, create, delete) is non-empty and matches the validated lists.
- The applicable-rules table is consistent with the project's rules inventory.
- When a brainstorm artifact was ingested, its path is recorded and no settled decision is contradicted without being surfaced.
- Confidence is at least 9.
