# 05 - Write INSTALL.md

Produce `aidd_docs/INSTALL.md` from the filled checklist, folder tree, diagram, and audit summary. This is the only file this skill writes to disk.

## Inputs

- Filled checklist (from action 04).
- Folder structure code block (from action 04).
- Mermaid diagram (from action 04).
- Augmented audit table (from action 03).

## Outputs

A new file at `aidd_docs/INSTALL.md` filled from `@${CLAUDE_PLUGIN_ROOT}/skills/01-bootstrap/assets/install-template.md`.

```markdown
# INSTALL.md - acme-invoicing

Technical vision and installation guide.

## Vision
...
## Decisions
...
## Stack summary
...
## Architecture
...
## Folder structure
...
## Install steps
...
## Audit summary
...
```

## Depends on

- `04-pick-and-design`

## Process

1. Read `@${CLAUDE_PLUGIN_ROOT}/skills/01-bootstrap/assets/install-template.md`. This is the skeleton.
2. Fill each placeholder from upstream artifacts:
   - **Vision**: project name + one-liner from block 1
   - **Decisions table**: each row from block 4 paired with a one-line `Why` derived from block 2-3 constraints
   - **Stack summary**: concrete versions / SaaS plans where known
   - **Architecture**: paste the Mermaid diagram from action 04 + 2-3 sentences explaining module boundaries
   - **Folder structure**: paste the tree from action 04 verbatim
   - **Install steps**: 3-7 imperative steps the user runs to bring up the empty project (init repo, install runtimes, create cloud accounts, set env vars). No code generation - this is a checklist, not a script.
   - **Audit summary**: paste the augmented table from action 03, keep verdicts + one-line notes
3. Write the filled content to `aidd_docs/INSTALL.md` in the user's project root. If the file already exists, ask before overwriting.
4. Print the relative path of the written file and a short summary (which sections were filled, total length).

## Test

`aidd_docs/INSTALL.md` exists and parses as markdown; it contains exactly these `## ` H2 headings in order: `Vision`, `Decisions`, `Stack summary`, `Architecture`, `Folder structure`, `Install steps`, `Audit summary`; the `Architecture` section contains a fenced ` ```mermaid ` block; the `Folder structure` section contains a fenced code block with at least 5 lines.
