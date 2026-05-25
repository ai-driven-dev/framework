# 02 - Verify

Run the cheapest-first verification cascade against each claim and assign it a verdict.

## Inputs

- `claim_list` (required) - the classified claim list from action 01.

## Outputs

A verdict list. Each claim gains a verdict and its supporting sources.

```json
[
  {
    "claim": "the source file plugins/aidd-refine/hooks/condense-stats.js exists in this repo",
    "category": "project-fact",
    "verdict": "verified",
    "tier": "codebase",
    "sources": ["plugins/aidd-refine/hooks/condense-stats.js"]
  }
]
```

## Depends on

- `01-identify-claims`

## Process

1. For each claim, walk the cascade in `@${CLAUDE_PLUGIN_ROOT}/skills/05-fact-check/references/verification-cascade.md`: tier 1 project memory and docs, tier 2 codebase inspection, tier 3 web lookup.
2. Route by category - `project-fact` favors tiers 1 and 2; other categories favor tier 1 then tier 3.
3. Short-circuit: the first tier that resolves the claim sets the verdict. Do not consult later tiers.
4. Respect the web-cost guardrail - reach tier 3 only after tiers 1 and 2 fail, prefer one authoritative source, stop once resolved.
5. Assign exactly one verdict: `verified` (record every source), `conflict` (record both sides with origin, pick no winner), or `unverified` (cascade exhausted, no source).
6. Emit the verdict list.

## Test

Run on the single claim `"the source file plugins/aidd-refine/hooks/condense-stats.js exists in this repo"` - the cascade resolves at the codebase tier (tier 2), the verdict is `verified`, the source is that file path, and the web tier is never reached.
