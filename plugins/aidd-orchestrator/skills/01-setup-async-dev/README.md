# 01 — Setup async-dev

Installs and configures the `async-dev` use case end-to-end in a target repo,
from a fresh clone to the first triggered run.

## When to use

- First time you enable async-dev on a repo.
- After a major config change (mode switch, marketplace move, auth rotation)
  that warrants regenerating the workflow and scripts.

## When NOT to use

- To run the async pipeline on an issue → use `02-run-async-dev`.
- To apply review feedback on a PR → use `03-review-async-dev`.
- For trivial config edits → edit `.claude/aidd-orchestrator.json` directly.

## How to invoke

```
Use skill aidd-orchestrator:01-setup-async-dev
```

The skill asks ~6 questions:

| Question | Default | Notes |
|----------|---------|-------|
| Mode | `both` | `local`, `remote`, or `both` |
| Anthropic auth | `oauth_token` | OAuth (Claude Pro/Max) or API key |
| Per-developer routing | `no` | If `yes`, each contributor's runs draw from their own quota |
| Marketplace repo + access | `ai-driven-dev/aidd-framework` public | Source of the plugin install at runtime |
| GitHub write auth | `pat` | `default`, `pat`, or `github_app` |
| Max review iterations | `3` | Auto-fix passes per PR |

## Outputs

- `.github/workflows/aidd-async.yml`
- `scripts/aidd-async-poll.sh` (+ `aidd-async-daemon.sh` when local)
- `.claude/aidd-orchestrator.json`
- The 5 lifecycle labels on the GitHub repo
- GitHub Action secrets via `gh secret set`
- A throwaway smoke-test issue (optional, prompted at the end)

## Prerequisites

- GitHub repo (public or private).
- `claude` CLI 2.1+ and `gh` CLI authenticated.
- An SDLC capability loaded in the runtime (default: `aidd-dev`).
- Three tokens at hand: the Anthropic auth, the marketplace clone secret (if
  private), and a PAT with `workflows:write` scope (if `pat` mode).

## Technical details

See [`SKILL.md`](SKILL.md) for the action contract, [`actions/`](actions/) for
each of the 11 atomic actions, and [`references/`](references/) for tradeoff
notes (auth modes, marketplace access, local-mode scheduling paths).
