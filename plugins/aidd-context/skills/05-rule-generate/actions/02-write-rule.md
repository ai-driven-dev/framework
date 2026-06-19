# 02 - Write rule

Build one canonical rule and write it for each supported tool.

## Input

From 01: the topic, category, slug, scope, and write mode.

## Output

One rule file per supported confirmed tool, the list of files written, and any skipped tool with its reason.

## Process

1. **Build.** Copy `@../assets/rule-template.md` into one canonical rule, concise. Strip the scaffold (comments + `<...>`).
2. **Dominance.** Compare each normative bullet against existing rules, docs, criteria, and context. Delete, merge, or scope bullets already covered, overridden, contradicted, or invalidated by another element. Keep repetition only when clearly marked as an example, migration note, or historical context.
3. **Frontmatter.** Set the per-tool frontmatter from `@../references/tool-paths.md`. Drop a field a tool does not support.
4. **Render.** Per the write mode (`@../references/tool-paths.md`):
   - **Host**: for each supported confirmed tool, write to its path and extension. Skip an unsupported tool, carrying its reason forward.
   - **Plugin source**: write one canonical `.md` rule. No per-tool fan-out.
5. **Split.** When examples warrant it, write several rule files rather than one crowded one.
6. **Validate.** Run the write-target validation (`@../references/tool-paths.md`).

## Test

- Each rule file exists at its tool's rules path under the chosen scope.
- The scope frontmatter matches the rule's reach, per `@../references/tool-paths.md`.
- No normative bullet is already covered, overridden, contradicted, or invalidated by another active element.
