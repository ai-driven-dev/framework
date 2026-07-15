# 03 - Draft SKILL.md

Write the router. No business logic.

## Input

From 01: the name, domain, what it produces, the invocation mode, the confirmed tools, and where to write. From 02: the plan.

## Output

One SKILL.md per target (each confirmed host tool, or the plugin source tree), and the list of files written.

## Process

1. **Build.** Copy `@../assets/skill-template.md` into one canonical SKILL.md. Strip the scaffold (comments + `<...>`).
   - Modify: edit in place. Keep non-router sections, change only the touched rows.
2. **Frontmatter.** Fill per R5 and the naming (`@../references/skill-authoring.md`). `name` equals the folder. For plugin source, or host tools that support it, `argument-hint` is REQUIRED once the skill has two or more actions. Independent actions: the action slugs joined with ` | `. A pipeline or loop (each action feeds the next): the user's cases, or omit when there is a single case, never the stage slugs. Omit entirely for a one-action skill. Manual mode adds the manual-only flag.
   - Host: per-tool frontmatter (`@../references/tool-paths.md`).
   - Plugin source: keep canonical `name` + `description`. Reconciled at install.
3. **Body.** Write the three-column action table (`# | Action | Does`); an action's input lives in its own `## Input`, never a router column. No intro sentence, no business logic. State the flow schema:
   - Strictly sequential: a one-line chain `01 → 02 → 03`, test each first. Never a mermaid for a plain sequence.
   - Loops or branches: a mermaid flowchart.
   - A self-skip shown in the flow line as the early exit, never by restating an action's condition and report (R6).
   - Delegates: add "spawn the named agent".
   - External call or secrets: state it here, leave the wiring to the user.
4. **Render.** Per the write mode:
   - **Host**: once per confirmed tool at its path (`@../references/tool-paths.md`).
   - **Plugin source**: once at `plugins/<plugin>/skills/<name>/`.
5. **Validate.** Run the write-target validation (`@../references/tool-paths.md`).

## Test

- Each SKILL.md exists and starts with `---` frontmatter.
- Each router carries only the flow schema, the action table, and the transversal rules (R1), and is the leanest file on any path (R4).
- The flow is a one-line chain for a sequential skill, a mermaid only for a loop or branch.
- No transversal rule restates a fact an action or reference already owns (R6).
- `argument-hint` names the user's cases for a pipeline or loop, the action slugs only for independent actions.
- The action table is three columns (`# | Action | Does`), with no input column.
- `argument-hint` is present for a skill with two or more actions and omitted otherwise, matching the plan's slugs or the named cases.
