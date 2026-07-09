<!-- Onboard screen shapes. 03-present fills the one 02-assess chose. Match the mockup gallery in the plan folder. -->

<!--
Glyphs, only in the state block: ✅ done · ⚠️ present, not wired · ❌ required, missing. Unused optional tools are omitted, never crossed.
Keys: the user replies with a bracketed token. [1] [2]… act, [OK] walks pending steps, [m] map, [?] detail. State keys inline, never a standalone "type N and press Enter" line.
Tier is a plain clause, shown only in [?]; the AUTO/GUIDED/MANUAL wording lives in references/run/tiers.md.
-->

## Entry screen (greenfield · existing · idle · drift)

```txt
<banner.txt injected>

👋  <framing: first report of the session only, e.g. "I'll walk you through AIDD step by step — nothing runs until you reply." / "Welcome back.">

Your AIDD setup:
  AI tools   <detected tools, each with ✅/⚠️>
  Plugins    <installed AIDD plugins>   ✅
  Memory     <aidd_docs/ · N files synced ✅  |  ❌ not set up yet>

<state sentence, or a ⚠️ warning line that carries its cause + the fix, per Warnings>

👉  <the top action>   [1]
    <other keyed options>   ·   see the flow [m]
```

- Framing shows on the first report of the session only, then drops on re-scans.
- The banner is injected from `banner.txt` on entry screens only.
- Idle: the flow (from `flow.md`) and `[1] Walk it with me · [2] Let SDLC drive it`, or the idle menu when the user opens it.

## Foundations step

```txt
Foundations — step <n> of <total>

  <deliverable>     <what it does, plain>
                    (<why it matters>)

👉  Type [1] to start.   skip [s] · what's this [?]
```

- `<total>` is 2 for an existing repo (memory first, stack skipped) or 3 for greenfield, per `flow.md`.

## Where you are (mid-work)

```txt
🔍  <state sentence, e.g. "Healthy — unsaved changes in progress.">

  Flow:  <the 8-step path with the current stage in [brackets], done stages marked ✅>

👉  Next: <the step>   [1]
    <other keyed options>
```

## Warnings that carry a fix

A `⚠️` never stands alone. Render its plain cause, then the fix as a keyed action:

```txt
⚠️  <what is wrong, plain: e.g. "codex is installed but its memory isn't wired (no AGENTS.md).">
   → Type [1] to <fix>.
```

## [?] detail

On `[?]`, expand the decision: each step's command id and tier clause, the per-check foundation reasons, and the read-only extras.

```txt
Details —
  1. <step>   <command-id>   (<tier clause>)
  ...
  <per-check foundation lines with ✅/⚠️/❌>
  explain <n> · recap · stop · back [<]
```

- `recap` only when a prior conversation exists; `explain project` only when memory is filled.
