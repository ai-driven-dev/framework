# 02 - Write rule

Build one canonical rule and publish it for each confirmed supported host.

## Input

From 01: the topic, category, slug, scope, and write mode.

## Output

The canonical source, generated targets, and any unsupported tool with its reason.

## Process

1. **Build.** For create/update, use [rule-template.md](../assets/rule-template.md); strip the scaffold. For publish/delete, skip to Render.
2. **Request.** For host create/update, put category, slug, description, optional paths and complete Markdown body into the JSON request in [tool-paths.md](../references/tool-paths.md). Keep YAML frontmatter out of the body.
3. **Render.** Per the write mode ([tool-paths.md](../references/tool-paths.md)):
   - **Host**: resolve `scripts/write-rule.cjs` beside the loaded installed `SKILL.md`. Invoke its absolute path with explicit project, tools and the operation's arguments in [tool-paths.md](../references/tool-paths.md). Use it for create/update, publish and delete; never replace or remove generated files manually. It preflights all outputs. Report refusals verbatim; skip unsupported tools with their reason.
   - **Plugin source**: write one canonical `.md` rule. No per-tool fan-out.
4. **Split.** When examples warrant it, write several rule files rather than one crowded one.
5. **Validate.** Check the script's reported targets against [tool-paths.md](../references/tool-paths.md). It must not require the AIDD CLI.

## Test

- Create/update/publish: canonical sources and active publications exist with the intended scope.
- Delete: the selected source and its publications are absent; remaining rules and user bytes survive.
