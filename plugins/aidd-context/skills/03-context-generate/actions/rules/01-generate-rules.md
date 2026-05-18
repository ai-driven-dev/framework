# 01 - Generate rules

Generate or modify coding rules, either from user input (manual mode) or by scanning the codebase (auto mode), then write each rule into every installed AI tool's native rules surface.

## Inputs

```yaml
arguments: <rule topic to write, or "auto"/"scan" to scan the codebase and propose rules>
```

## Outputs

```yaml
mode: auto | manual
files_written:
  - { tool: <id>, path: <tool rules root>/<category>/<slug>.<ext> }
  - ...
```

## Process

1. **Detect mode.**
   - `arguments` is `auto` or `scan` -> auto mode (step 2A).
   - Otherwise -> manual mode (step 2B).

2A. **Auto mode - scan codebase.**
   - Scan source files, configs, dependencies, and directory structure.
   - Identify patterns, conventions, tech stack usage, existing rules.
   - Propose a complete rules architecture: list categories and rule files, show groups and sub-groups per file, display the proposed file tree.
   - WAIT FOR USER APPROVAL before proceeding to step 3.

2B. **Manual mode - user-guided.**
   - Remind project context: tech stack, versions, architecture, existing rules.
   - Define categories, one file per category.
   - Look for existing rules to update.
   - Plan the new rule(s) structure: file, groups and sub-groups, display the proposed architecture.
   - WAIT FOR USER APPROVAL before proceeding to step 3.

3. **Pick category + slug deterministically.** Apply the selection rubric in `@../../references/rule-structure.md` (walk top to bottom, stop at first hit). The chosen category index drives the slug prefix (rules in `02-programming-languages/` start with `2-`; rules in `03-frameworks-and-libraries/` start with `3-`; etc.). State the chosen category + slug in writing before proceeding.

4. **Generate.** For every installed AI tool, write the rule file inside that tool's rules root using `@../../assets/rules/rule-template.md` and the conventions in `@../../references/ai-mapping.md` (path, naming, extension, frontmatter). Skip any tool whose rules surface is marked "not supported". Create the rules root and the category subdirectory on demand (`mkdir -p`) before writing; do not assume the directory tree has been pre-scaffolded.

   The category subdirectory and the slug stay identical across tools; only the root, extension, and frontmatter shape differ.

   Reference example rule file structure (illustrative):

   ```text
   03-frameworks-and-libraries/
   ├── 3-react@19-components-structure.<ext> (paths: ['**/*.tsx', '**/components/**', ...])
   │   ├── Component definition basics
   │   ├── Export patterns
   │   ├── Props and typing
   │   └── Naming conventions
   └── ...
   ```

5. **Boundaries.**
   - Be concise. Less is more.
   - If multiple examples warrant separate files, create multiple rule files.

## Test

For every installed AI tool whose rules surface is supported, the generated rule file exists at `<tool rules root>/<category>/<slug>.<ext>` with frontmatter matching the tool-specific shape from `@../../references/ai-mapping.md`. Content follows the conventions in `@../../references/rule-writing.md` and `@../../references/rule-structure.md`.
