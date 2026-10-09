# 02 - Write rule

Build one canonical rule and publish it for each confirmed supported host.

## Input

From 01: the topic, category, slug, scope, and write mode.

## Output

The canonical source, generated targets, and any unsupported tool with its reason.

## Process

1. **Build.** Copy [rule-template.md](../assets/rule-template.md) into one canonical rule, concise. Strip the scaffold (comments + `<...>`).
2. **Request.** For host mode, put category, slug, one-line description, optional paths and complete Markdown body into the JSON request in [tool-paths.md](../references/tool-paths.md). Keep YAML frontmatter out of the body.
3. **Render.** Per the write mode ([tool-paths.md](../references/tool-paths.md)):
   - **Host**: resolve the installed skill's `plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs` to an absolute installed path and invoke it with explicit project, tools and JSON input, following [tool-paths.md](../references/tool-paths.md). It preflights every output before any mutation. Report a refusal verbatim; do not write sources first or replace outputs manually. Skip unsupported tools with their reason.
   - **Plugin source**: write one canonical `.md` rule. No per-tool fan-out.
4. **Split.** When examples warrant it, write several rule files rather than one crowded one.
5. **Validate.** Check the script's reported targets against [tool-paths.md](../references/tool-paths.md). It must not require the AIDD CLI.

## Test

- The canonical source and native files or shared contribution exist at their expected paths.
- Native scope metadata or shared scope instructions match the rule's reach, per [tool-paths.md](../references/tool-paths.md).
