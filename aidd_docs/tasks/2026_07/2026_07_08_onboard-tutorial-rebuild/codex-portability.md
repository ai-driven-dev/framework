# Codex portability — before and after the router fix

The skill triggered on Codex from the start, but rendered nothing. Root cause: the
'read an action's file before running it' rule had been moved into skill-authoring.md,
a contract no executing host ever reads. Codex read SKILL.md and stopped.

## Before — Codex reads SKILL.md and stops

```text
I'm using `aidd-context:00-onboard` because you asked to be onboarded.
[reads .../skills/00-onboard/SKILL.md]
[no banner, no setup block, no foundations screen — improvises a generic answer]
```

Full capture: `headless-runs-codex.txt` (all eight states, pre-fix).

## After — the router carries the operative line

`SKILL.md`: `Run the actions in that order, looping. Read an action's file in \`actions/\` before running it.`

```text
 █████╗ ██╗██████╗ ██████╗
██╔══██╗██║██╔══██╗██╔══██╗
███████║██║██║  ██║██║  ██║
██╔══██║██║██║  ██║██║  ██║
██║  ██║██║██████╔╝██████╔╝
╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝
 AI-Driven Development 🇫🇷

exec
/bin/zsh -lc "test -f AGENTS.md && sed -n '1,160p' AGENTS.md || true" in /private/tmp/aidd-demo/01-greenfield
exec
/bin/zsh -lc "test -f RTK.md && sed -n '1,220p' RTK.md || true" in /private/tmp/aidd-demo/01-greenfield
 succeeded in 0ms:
 succeeded in 0ms:
exec
/bin/zsh -lc "find . -maxdepth 2 -type f -o -type d | sort | sed -n '1,160p'" in /private/tmp/aidd-demo/01-greenfield
 succeeded in 0ms:
.
./.git
./.git/HEAD
./.git/config
./.git/description
./.git/hooks
./.git/info
```

Probes: READ THE ACTIONS ✓ · BANNER ✓ · SETUP BLOCK ✓ · FOUNDATIONS ✓
Identical shape to the Claude run in `headless-runs.md`.
