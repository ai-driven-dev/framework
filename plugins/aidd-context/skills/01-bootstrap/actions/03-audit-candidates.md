# 03 - Audit candidates

Spawn one parallel agent per candidate to validate the proposed stack: tech compatibility, ecosystem maturity, known gotchas. Returns a verdict (`✅ / ⚠️ / ❌`) plus a 3-bullet rationale per candidate.

## Inputs

- Comparison table from action 02.
- Filled checklist from action 01 (for context).

## Outputs

The same table from action 02, augmented with a `Verdict` column and a per-candidate rationale block below.

```markdown
| Candidate | Verdict | Notes |
|-----------|---------|-------|
| **A. Vercel-native** | ✅ | All components mature, well-documented integration, no gotchas at this scale |
| **B. Self-hosted** | ⚠️ | Coolify is recent (< 2 years); ops burden underestimated for solo dev |
| **C. Serverless AWS** | ❌ | DynamoDB is the wrong fit for relational invoice data; Cognito has known UX friction |
```

Per-candidate rationale (3 bullets):

```markdown
### A. Vercel-native - ✅
- Next.js + Supabase is the most documented stack in 2026; copy-paste examples exist for every checklist requirement
- Vercel's Hobby tier plus Supabase free tier covers the 6-month volume target; cost forecast holds
- Cold start is the only concrete risk - irrelevant for a B2B SaaS with predictable load patterns

### B. Self-hosted - ⚠️
- ...
```

## Depends on

- `02-propose-candidates`

## Process

1. For each candidate row in the table, spawn a parallel `general-purpose` Agent with this brief:

   ```
   Audit the following candidate stack for a SaaS project. Validate three dimensions:
   1. Tech compatibility - do the components integrate cleanly? Any deprecated combos?
   2. Ecosystem maturity - are the components stable (≥ 2 years prod-tested) and well-documented?
   3. Known gotchas - search recent (last 12 months) issues, blog posts, HN discussions for blockers.

   Project context: <paste filled checklist blocks 1-3>
   Candidate: <paste candidate row from comparison table>

   Return:
   - Verdict: ✅ (no blocker) / ⚠️ (minor concerns) / ❌ (deal-breaker)
   - Three bullet points justifying the verdict - concrete, citing specific tech facts
   - Cost estimate confirmation: agree / disagree with the proposed monthly cost
   ```

2. Wait for all agents to return. Aggregate verdicts into the table.
3. If **every** candidate returns `❌`: print the verdicts, surface the common blocker, and loop back to action 02 with explicit guidance on what to change. Do not proceed to action 04.
4. If **at least one** candidate is `✅` or `⚠️`: print the augmented table + per-candidate rationale to the user. Pass control to action 04.

## Test

Each candidate row from action 02 has a corresponding verdict in `{✅, ⚠️, ❌}` and a rationale block with exactly 3 bullets; if all verdicts are ❌, the flow does not advance to action 04 and a guidance message back to 02 is printed.
