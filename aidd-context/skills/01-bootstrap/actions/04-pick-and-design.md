# 04 - Pick and design

The user picks the winning candidate, informed by the audit. Generate the folder-structure tree and a Mermaid module diagram, and fill block 4 of the checklist with the concrete choices.

## Input

The augmented comparison table from action 03 (verdicts and rationale), and the filled checklist blocks 1 to 3.

## Output

Three artifacts held in conversation context: the checklist with block 4 filled (architecture pattern, front, back, DB, auth, final hosting), a folder-structure code block of the project root tree, and a Mermaid diagram of the modules and their relations.

## Process

1. **Pick.** Print the action 03 augmented table and ask the user to pick a candidate by name.
2. **Vet.** On a ⚠️ pick, surface the audit concerns, ask for a mitigation plan, and loop until satisfied or the pick changes. On a ❌ pick, refuse and loop back; never proceed with a known-broken stack.
3. **Fill.** Fill block 4 with the picked candidate's concrete choices, show the full checklist, and wait for the user to confirm "go".
4. **Tree.** Generate the folder-structure tree following the picked stack's conventions: a monorepo (`apps/`, `packages/`) for a modular monolith, a flat `src/` for a monolith, `services/` per service for microservices, `functions/` for serverless. Reflect every block-4 component.
5. **Diagram.** Generate the Mermaid module diagram via a Mermaid-rendering capability, passing the modules and relations from the tree, and confirm it parses without error.
6. **Show.** Print the tree and diagram together, then wait for confirmation before action 05.

## Test

- Block 4 has all six items filled with no remaining `<...>` placeholders.
- A folder-structure code block is rendered, and a fenced `mermaid` block is present and parses without error.
- The user confirmed in writing.
