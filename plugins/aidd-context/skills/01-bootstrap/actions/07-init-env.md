# 07 - Init env

Environment and secrets. Enumerate every variable the project needs and wire config loading. No secret values committed.

## Inputs

- The building blocks and runtime wired by `06-init-dependencies` - they determine the required env keys.

## Process

1. Derive the required env keys from the building blocks wired in `06` (each provider, the database, the runtime).
2. Write `.env.example` listing every key with a placeholder - never a real value.
3. Wire config loading so the app reads from the environment.

## Test

- [ ] `.env.example` lists every required key.
- [ ] App reads its config from the environment.
- [ ] No secret value committed.
