---
name: auto-implement
description: Autonomously run the AI-Driven Development workflow to code a high quality feature using durable project memory.
argument-hint: The URL or file path of the issue or task to implement.
---

# Auto Implement

> Do not stop to ask questions or wait for confirmation. Do not pause between steps. Proceed through every step until the whole process is complete. This constraint applies to this agent and to every sub-agent it spawns.

## Goal

Autonomously code a high quality feature end-to-end, staying coherent across long sessions through durable project memory and milestone-based verification.

## Durable Project Memory

Three files form the shared memory that prevents drift and keeps a stable definition of "done."

| File           | Path                                                | Role                                                                                                              |
| -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frozen spec    | `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.spec.md`   | Requirements, written once, never modified. Template: `{{DOCS}}/templates/aidd/prompt.md`                         |
| Milestone plan | `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.plan.md`   | Milestones with acceptance criteria. Amendable during implementation. Template: `{{DOCS}}/templates/aidd/plan.md` |
| Status file    | `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md` | Living audit log updated after each milestone. Template: `{{DOCS}}/templates/aidd/status.md`                      |

## Process

1. List available MCP tools in bullet list, remember that they can be used.
2. Resolve `<YYYY_MM>` and `<FEATURE_NAME>` from the input.
3. Execute steps 1 through 7 sequentially. Each step spawns a sub-agent with the prompt in its code block. Do not work in parallel — complete each step fully before the next.

Placeholders:

- `{{DOCS}}`, `{{TOOLS}}` — resolved by the framework
- `<YYYY_MM>`, `<FEATURE_NAME>`, `<INPUT>`, `<MILESTONE_NUMBER>`, `<MILESTONE_NAME>` — resolved by the parent agent before passing the prompt to the sub-agent

---

### Step 1: Freeze the spec

> Creates a structured requirements document from the issue input.

```markdown
You are working autonomously under an AI agent named Alexia. Do not wait for human input. Proceed until complete.

Read these files:

- `{{DOCS}}/templates/aidd/prompt.md` (template to follow)
- `{{TOOLS}}/commands/02_context/brainstorm.md` (use as a checklist, skip interactive steps)

Task: Parse the following input: `<INPUT>`. Extract and structure requirements using the prompt.md template. Make reasonable assumptions and document them in the spec.

Save the result to: `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.spec.md`

Done when: spec.md exists, follows the template structure, all requirements from the input are captured, and assumptions are documented.
```

---

### Step 2: Generate milestone plan

> Produces a milestone-based plan with acceptance criteria and initializes the status file.

```markdown
You are working autonomously under an AI agent named Alexia. When instructions say to wait for user approval, finalize your output and complete — Alexia reviews after completion.

Read these context files:

- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.spec.md` (frozen spec — this is what we are building)
- `{{DOCS}}/templates/aidd/status.md` (status template to initialize)

Read and follow this command as your main prompt: `{{TOOLS}}/commands/03_plan/plan.md`
The `$ARGUMENTS` in that command refers to the frozen spec — use the content of `spec.md` as the requirements input.

Additional requirements:

- Fill the risk register and demo script sections in the plan.
- Initialize the status file from the status template and save to `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md`.
- Save plan to `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.plan.md`

Done when: plan.md has milestones with acceptance criteria, risk register, and demo script. status.md is initialized.
```

---

### Step 3: Implement changes

> The parent agent loops over milestones and spawns one sub-agent per milestone.

**Parent agent orchestration:**

1. Read `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.plan.md` to get the ordered list of milestones.
2. For each milestone in order, spawn a sub-agent with the prompt below (replacing `<MILESTONE_NUMBER>` and `<MILESTONE_NAME>`).
3. After each sub-agent completes, read `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md` to confirm the milestone is marked done. Then proceed to the next milestone.
4. After all milestones are done, proceed to step 4.

```markdown
You are working autonomously under an AI agent named Alexia. Do not wait for human input. Proceed until complete.

Read these files:

- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.spec.md` (frozen spec)
- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.plan.md` (milestone plan — source of truth)
- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md` (current status)
- `coding_assertions.md` (verification commands)

Read and follow the rules from: `{{TOOLS}}/commands/04_code/implement.md`

Task: Implement milestone <MILESTONE_NUMBER>: <MILESTONE_NAME>. Follow the plan's tasks and acceptance criteria for this milestone only.

Rules:

- Changes must only touch what this milestone requires. No drive-by refactors.
- After implementation, run ALL verification commands from `coding_assertions.md`. If any fail, fix immediately. Repeat until all pass.
- Update `status.md` with: milestone completion, decisions made, assumptions, verification results.
- Commit with a message referencing the milestone name.

Done when: all acceptance criteria for this milestone are met, all verification commands pass, status.md is updated, and changes are committed.
```

---

### Step 4: Final commit

> Commits any remaining uncommitted changes.

```markdown
You are working autonomously under an AI agent named Alexia. When instructions say to wait for user approval, finalize your output and complete — Alexia reviews after completion.

Read: `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md`

Read and follow this command as your main prompt: `{{TOOLS}}/commands/08_deploy/commit.md`

Mode: `auto`

Done when: working tree is clean and all changes are committed.
```

---

### Step 5: Code review

> Reviews code quality and fixes issues found.

```markdown
You are working autonomously under an AI agent named Alexia. Do not wait for human input. Proceed until complete.

Read these context files:

- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.spec.md` (frozen spec)
- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.plan.md` (milestone plan)
- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md` (current status)
- `coding_assertions.md` (verification commands)

Read and follow this command as your main prompt: `{{TOOLS}}/commands/05_review/review_code.md`

Additional requirements:

- If issues are found, fix them and run verification commands from `coding_assertions.md`.
- Update `status.md` with review findings.
- Commit fixes.

Done when: no code quality issues remain, all verification commands pass, fixes are committed.
```

---

### Step 6: Functional review

> Validates the feature against the spec and fixes gaps.

```markdown
You are working autonomously under an AI agent named Alexia. When instructions say to wait for user approval, finalize your output and complete — Alexia reviews after completion.

Read these context files:

- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.spec.md` (frozen spec)
- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.plan.md` (milestone plan)
- `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md` (current status)
- `coding_assertions.md` (verification commands)

Read and follow this command as your main prompt: `{{TOOLS}}/commands/05_review/review_functional.md`

Additional requirements:

- Test the demo script from the plan.
- If gaps are found, fix them and run verification commands from `coding_assertions.md`.
- Update `status.md` with review findings.
- Commit fixes.

Done when: feature matches the spec, demo script runs successfully, all verification commands pass, fixes are committed.
```

---

### Step 7: Create PR

> Creates the pull request with the status file as summary.

```markdown
You are working autonomously under an AI agent named Alexia. When instructions say to wait for user approval, finalize your output and complete — Alexia reviews after completion.

Read: `{{DOCS}}/tasks/<YYYY_MM>/<FEATURE_NAME>.status.md`

Read and follow this command as your main prompt: `{{TOOLS}}/commands/08_deploy/create_request.md`

Additional requirements:

- Update the status file with final state before creating the PR.
- Include the content of `status.md` as the PR description.

Done when: PR is created with status summary in the description.
```

---

## Completion criteria

Do not consider the process complete until ALL of the following are true:

- All milestones in `plan.md` are implemented and checked off
- All verification commands from `coding_assertions.md` pass on the final codebase
- The status file reflects the final state of every milestone
- A PR has been created
