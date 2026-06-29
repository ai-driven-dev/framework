# 03 - Draft SKILL.md

Write the router. No business logic.

## Input

From 01: the name, domain, what it produces, the invocation mode, the confirmed tools, and where to write. From 02: the plan.

## Output

One SKILL.md per target (each confirmed host tool, or the plugin source tree), and the list of files written.

## Process

1. **Build.** Copy `@../assets/skill-template.md` into one canonical SKILL.md. Strip the scaffold (comments + `<...>`).
   - Modify: edit in place. Keep non-router sections, change only the touched rows.
2. **Frontmatter.** Fill per R5 and the naming (`@../references/skill-authoring.md`). `name` equals the folder. For plugin source, or host tools that support it, `argument-hint` lists action names only when the skill has two or more actions, joined with ` | `, and must match the action plan. Manual mode adds the manual-only flag.
   - Host: per-tool frontmatter (`@../references/tool-paths.md`).
   - Plugin source: keep canonical `name` + `description`. Reconciled at install.
3. **Body.** Write the action table. State the flow in one line.
   - Chain: `01 → 02`, test each first.
   - Independent: the router runs the matching one, or several.
   - Delegates: add "spawn the named agent".
   - External call or secrets: state it here, leave the wiring to the user.
4. **Render.** Per the write mode:
   - **Host**: once per confirmed tool at its path (`@../references/tool-paths.md`).
   - **Plugin source**: once at `plugins/<plugin>/skills/<name>/`.
5. **Validate.** Run the write-target validation (`@../references/tool-paths.md`).

## Test

- Each SKILL.md exists and starts with `---` frontmatter.
- Each is 500 lines or fewer and sits under the target base.
- The action-table slugs match the plan. `argument-hint` is omitted for one-action skills; when emitted, its action names match the plan.
