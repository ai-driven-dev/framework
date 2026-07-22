---
paths:
  - "src/infrastructure/auth/**/*.ts"
  - "src/application/use-cases/**/*.ts"
---

# Auth

## Token resolution priority

1. `AIDD_TOKEN` env var
2. Project `.aidd/auth.json`
3. User `~/.config/aidd/auth.json`
4. `gh auth token` — only when stored config uses `method: "gh"`

## Storage

- Credentials stored with `chmod 600`
- Two levels: `"project"` (`.aidd/`) and `"user"` (`~/.config/aidd/`)
- Auth validated via GitHub API — token presence alone is not sufficient

## Auth entry point

- `RequireAuthUseCase` — single source of auth validation
- Never duplicate auth checks across commands or use-cases
- Auth for local framework paths is never required
