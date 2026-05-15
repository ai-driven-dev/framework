# 04 - Pick and design

User picks the winning candidate (informed by audit). Generate the folder structure tree and a Mermaid module diagram. Fill block 4 of the checklist with the concrete choices.

## Inputs

- Augmented comparison table from action 03 (with verdicts and rationale).
- Filled checklist blocks 1-3.

## Outputs

Three artifacts held in conversation context (not yet written to disk):

1. The checklist with **block 4 filled** (architecture pattern, front, back, DB, auth, final hosting).
2. A folder-structure code block showing the project root tree.
3. A Mermaid diagram showing modules and their relations.

```markdown
## Folder structure

`​`​`
acme-invoicing/
├── apps/
│   ├── web/                  # Next.js app
│   └── workers/              # Background jobs (BullMQ)
├── packages/
│   ├── db/                   # Drizzle schema + migrations
│   ├── api/                  # tRPC routers shared between web and workers
│   └── ui/                   # shared React components
├── infra/
│   └── supabase/             # Supabase project config + RLS policies
├── aidd_docs/
│   └── INSTALL.md
└── package.json
`​`​`

## Architecture diagram

`​`​`mermaid
graph TD
    User --> Web[Next.js Web]
    Web --> API[tRPC API]
    API --> DB[(Supabase Postgres)]
    API --> Airtable[Airtable SDK]
    Web --> Auth[NextAuth]
    Workers[BullMQ Workers] --> DB
    Workers --> Slack[Slack API]
`​`​`
```

## Depends on

- `03-audit-candidates`

## Process

1. Print the action 03 augmented table. Ask the user to pick a candidate by letter (A / B / C).
2. If the picked candidate has verdict `⚠️`, surface the audit concerns directly: list the specific risks found in action 03, ask whether the user has a mitigation plan, and loop until satisfied or candidate is switched.
3. If the picked candidate has verdict `❌`, refuse the pick and loop back to letting the user choose differently. (Do not proceed with a known-broken stack.)
4. Fill block 4 of the checklist with the picked candidate's concrete choices. Show the user the full filled checklist (all 24 items now) and ask them to confirm "go".
5. Generate the folder-structure tree following conventions from the picked stack: monorepo (`apps/`, `packages/`) for modular monolith; flat `src/` for monolith; `services/` per service for microservices; `functions/` for serverless. Reflect every component listed in block 4.
6. Generate the Mermaid module diagram by invoking `aidd-context:04:mermaid`. Pass it the list of modules and their relations derived from the folder tree. Verify the rendered diagram passes Mermaid syntax (no parser errors).
7. Print the tree + diagram together. Wait for user confirmation before action 05.

## Test

The checklist's block 4 has all 6 items filled with no remaining `<...>` placeholders; a folder-structure code block is rendered; a Mermaid code block tagged ` ```mermaid ` is present and parses without error; the user has confirmed in writing.
