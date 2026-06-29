# 01 - Read project

Read the project lightly and **silently**. No questions, no writes, no visible output. The few facts gathered are working notes the next action uses to orient the user.

## Input

The project root, the current working directory.

## Output

Internal working notes only, **never printed**. Onboard must not show a snapshot or a list of checks. The first thing the user sees is the briefing from `02-orient`.

The notes answer a handful of plain questions:

- Is the project memory set up? Does `aidd_docs/memory/` exist, and does any file hold real content rather than a bare template?
- When the memory is filled, what does it say the project is? Read the project brief and the architecture for the project's purpose, stack, and shape. This is the project's own context, and it leads the briefing.
- Does the AI context file carry the `<aidd_project_memory>` block?
- Is there code yet, and what stack? A manifest like `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, or the stack named in the memory when there is no manifest.
- Is there a spec or a plan under `aidd_docs/`?
- Is there an open pull request on the current branch?
- Is the repo empty, nothing built yet?
- Which AIDD plugins and skills are installed, with each skill's description?

## Process

1. **Check the setup.** Check whether the memory bank exists and holds real content rather than a bare template. When it is filled, read the project brief and the architecture so the briefing speaks from the project's own context. Check whether the AI context file carries the `<aidd_project_memory>` block.
2. **Check the work.** Look for source files outside `aidd_docs/`, a stack manifest, a spec or plan under `aidd_docs/`, and an open pull request on the branch. If nothing is built at all, note the repo as empty.
3. **List what is installed.** Use the AI tool's native plugin and skill discovery to gather the enabled AIDD plugins and the skills they expose, each with its description. This is how onboard adapts to what the user actually has.
4. **Hold, do not print.** Keep the notes in context and hand directly to `02-orient`. Emit nothing, even in a single turn; the user's first words come from `02-orient`.

## Test

- The action produces zero user-visible output. No snapshot, no check list, no labels appear.
- The setup facts, the work facts, and the installed-skill list are all available to `02-orient`.
- No skill id is named in the conversation by this action.
