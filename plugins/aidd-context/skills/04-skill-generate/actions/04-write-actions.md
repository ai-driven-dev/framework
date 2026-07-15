# 04 - Write action files

One file per action in the plan, under each confirmed tool's skills root.

## Input

From 02 the plan, from 03 the files written, from 01 where to write.

## Output

One file per action, per confirmed tool, at `<skills root>/<name>/actions/<NN>-<slug>.md`.

## Process

1. **Resolve.** Host mode: for each confirmed tool, resolve the skills root from `@../references/tool-paths.md`. Plugin source: use `plugins/<plugin>/skills/<name>/`.
2. **Fill.** For each action, fill `@../assets/action-template.md`: strip the scaffold (comments + `<...>`), copy the test from 02 verbatim into `## Test`. Never restate a rule the router's transversal rules already carry, nor a fact a reference owns: act within the rule, cite the reference (R6).
3. **Keep the hint true.** For independent actions, `argument-hint` matches the final action-file slugs. For a pipeline or loop, keep the case-based hint from 03 untouched, never re-derive it from slugs. In this repository the slug case is synced by `node scripts/sync-skill-argument-hints.mjs`; a case-based hint is exempt from that hook.
   - Modify: write only the changed actions, leave the rest untouched.
4. **Compose.** Include any template or reference via `@<path>`. Never "read X then apply".
5. **Validate.** Run the write-target validation (`@../references/tool-paths.md`).

## Test

- Each action file exists and carries `## Output`, `## Process`, `## Test`.
- No action restates a router transversal rule or a shared reference (R6).
- One-action skills omit `argument-hint`. For independent actions it lists the action slugs; for a pipeline or loop it names the user's cases.
- Each sits under the target base.
