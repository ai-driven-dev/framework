# 04 -- Check SDLC

Discovers an active SDLC orchestration capability in the runtime before delegation.

## Inputs

- none (reads runtime skill catalog)

## Outputs

```json
{
  "sdlc_available": true,
  "discovered_skill": "<runtime-resolved skill name>",
  "match_signal": "description"
}
```

## Depends on

- `03-acquire-lock`

## Process

1. List loaded skills via the runtime catalog (the same list that powers `Skill` tool dispatch).
2. Search for a skill whose `description` advertises SDLC orchestration: keywords such as `SDLC orchestrator`, `plan, implement, test, review, commit, PR`, or `software development lifecycle`. Match by description, not by hardcoded name.
3. Apply tie-breakers if multiple candidates exist: prefer the one declaring `orchestrator`, then the shortest name, then the first encountered. Record the chosen skill name in `discovered_skill`.
4. If no candidate matches, post a comment on the issue explaining that an SDLC orchestration skill must be loaded, release the lock by removing `config.labels.working` and re-adding `config.labels.to_implement`, and abort the cycle with a non-zero exit so the run is marked failed.

## Test

In a sandbox where no SDLC-advertising skill is loaded, running this action posts the missing-capability comment, swaps `claude/working` back to `to-implement`, and exits non-zero. With at least one such skill loaded, it returns `sdlc_available = true` and the chosen skill name without side effects.
