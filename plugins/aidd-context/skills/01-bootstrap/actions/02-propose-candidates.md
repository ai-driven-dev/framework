# 02 - Propose candidates

Derive 2-3 candidate stacks from the filled checklist using the heuristics in `@${CLAUDE_PLUGIN_ROOT}/skills/01-bootstrap/references/stack-heuristics.md`, then render a markdown comparison table for the user.

## Inputs

- Filled checklist (blocks 1-3) from action 01.

## Outputs

A markdown comparison table with 2-3 rows.

```markdown
| Candidate | Front | Back | DB | Hosting | Auth | Archi | Cost/mo | Risks |
|-----------|-------|------|------|---------|------|-------|---------|-------|
| **A. Vercel-native** | Next.js SSR | Next.js API routes | Supabase Postgres | Vercel + Supabase | NextAuth | Modular monolith | ~30€ | Vercel lock-in, cold starts on serverless functions |
| **B. Self-hosted** | Vite + React SPA | NestJS | Postgres on VPS | Coolify on Hetzner VPS | Clerk | Modular monolith | ~15€ | Manual ops, single point of failure |
| **C. Serverless AWS** | Next.js SSR | AWS Lambda + API Gateway | DynamoDB | AWS + CloudFront | Cognito | Serverless | ~50€ at low volume, scales linearly | Vendor lock-in, learning curve |
```

## Depends on

- `01-gather-needs`

## Process

1. Read the filled checklist from action 01.
2. Apply each rule from `@${CLAUDE_PLUGIN_ROOT}/skills/01-bootstrap/references/stack-heuristics.md` to derive the recommended family for: archi pattern, front, back, DB, auth, hosting.
3. Build 2-3 candidates that span the trade-off space - they must differ on at least one of: hosting model (PaaS vs self-host vs serverless), back-end language, or archi pattern. Never propose 3 near-identical candidates.
4. For each candidate, estimate monthly cost at the user's volume target (Block 2 item: "Volume at 6 months"). Use rough public-pricing numbers; flag uncertainty.
5. List 1-3 risks per candidate (lock-in, ops burden, learning curve, scaling limit). Be honest - risks are non-negotiable, no candidate has zero.
6. Render the comparison table. Bold the candidate's name (`**A.**`).
7. Print the table to the user. Do not pick a winner - that's action 04, after audit.

## Test

The output is a markdown table with at least 2 rows; the columns include `Front`, `Back`, `DB`, `Hosting`, `Auth`, `Archi`, `Cost`, `Risks`; each row has a non-empty value in every column; at least two rows differ on hosting model, back-end language, or archi pattern.
