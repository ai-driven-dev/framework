---
status: done
---

# Instruction: The command asks, the flags answer, status and report name the person

## Architecture projection

```txt
cli/src/presentation/commands/telemetry.ts                          ✏️ on: --as, --anonymous; checks; question via Prompter.select (+ input for another id)
cli/src/presentation/display/telemetry/*                            ✏️ on output names the identity; status line; person absent label `anonymous`
cli/src/contexts/telemetry/application/telemetry-status-use-case.ts ✏️ the identity, if the status result lacks it
```

## Tasks

1. Red first, one test per Surface row and Rules row of the contract: `--as` + `--anonymous` error; `--as` invalid error; `--yes` without choice and no identity error, nothing written; `--anonymous` with identity set error naming `identity --off`; interactive question offers proposal / another / anonymous, no proposal => two choices; identity set => no question; `AIDD_TELEMETRY=0` => no git proposal read; status names person or `anonymous` + how to be named; text report person row `anonymous`; JSON envelope unchanged. Record red.
2. Code to green, thin command per `cli/.claude/skills/command`.
