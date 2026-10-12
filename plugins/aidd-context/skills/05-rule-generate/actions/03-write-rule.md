# 03 - Write rule

Write the approved canonical rule and publish it for each confirmed supported host.

## Input

From 02: the explicitly approved complete candidate, scope, destinations and resolution. Or from 01: an explicitly confirmed existing publish/delete selection.

## Output

The canonical source, generated targets, and any unsupported tool with its reason.

## Process

1. **Approval.** For create/update, consume the exact candidate approved in action 02, including body, metadata, scope and destinations. Do not regenerate, split or rewrite it after approval. If any of these change, return to 02 before writing. Keeping existing rules or cancelling has no write path. For publish/delete, skip to Render.
2. **Request.** For host create/update, put category, slug, description, optional paths and complete Markdown body into the JSON request in [tool-paths.md](../references/tool-paths.md). Keep YAML frontmatter out of the body.
3. **Render.** Per the write mode ([tool-paths.md](../references/tool-paths.md)):
   - **Host**: resolve `scripts/write-rule.cjs` beside the loaded installed `SKILL.md`. Invoke its absolute path with explicit project, tools and the operation's arguments in [tool-paths.md](../references/tool-paths.md). Use it for create/update, publish and delete, including explicitly approved canonical updates or deletions in a merge/replacement resolution; never replace or remove generated files manually. It preflights all outputs. Report refusals verbatim; skip unsupported tools with their reason.
   - **Plugin source**: write one canonical `.md` rule. No per-tool fan-out.
4. **Validate.** Check the script's reported targets against [tool-paths.md](../references/tool-paths.md). It must not require the AIDD CLI.

## Test

- Create/update/publish: canonical sources and active publications exist with the intended scope.
- Create/update: the written body is the approved body; no existing source was modified or removed without its explicit resolution.
- Delete: the selected source and its publications are absent; remaining rules and user bytes survive.
