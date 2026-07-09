---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Present action (tutorial render)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/skills/00-onboard/
├── actions/
│   ├── ✅ 03-present.md        # renamed from 02-report.md, renders the screen assess chose
│   └── ❌ 02-report.md
├── references/
│   └── ✅ flow.md              # 8-step curriculum + 2 foundation paths, source of [map]
└── assets/
    ├── ✏️ report.md            # the screen shapes (state block, foundations, flow, next, [?], warnings)
    └── ✅ banner.txt           # AIDD ASCII banner, injected
```

## Wireframe

<!-- UI phase only. -->

```txt
The confirmed screens are the mockup gallery: ./onboard-mockups.html
(18 screens, 6 sections, colleague-approved). Render to match it. Canonical examples:

 █████╗ ██╗██████╗ ██████╗     <- banner.txt
 AI-Driven Development

👋  Welcome back.

Your AIDD setup:
  AI tools   claude ✓   codex ⚠
  Plugins    aidd-context · pm · refine · dev · vcs   ✓
  Memory     aidd_docs/ · 8 files synced   ✓

⚠  codex is installed but its memory isn't wired (no AGENTS.md).
   → Type [1] to wire it.

--- flow (walk vs SDLC) ---
  brainstorm → spec* → plan → implement → assert → review → commit → PR
   [1] Walk it with me   [2] Let SDLC drive it   map [m] · [?]
```

## Tasks to do

### `1)` Write the curriculum reference

> The teaching content, on-demand only.

1. `flow.md`: the 8 steps (brainstorm, spec*, plan, implement, assert, review, commit, PR) each with a one-line what/why; the vertical annotated layout (tutorial) and the horizontal compact layout (`[map]`).
2. Add the two foundation paths: existing => memory-first (2 steps, bootstrap skipped); greenfield => stack, memory, wire (3 steps).

### `2)` Author the render shapes

> Rich screens, terse rules.

1. `assets/banner.txt`: the AIDD ASCII banner as a plain injected block.
2. `assets/report.md`: the state block (glyph semantics + warning-carries-a-fix line), the framing line (first report only), foundations-step screen, the flow screen, the `Next` line with keys, the `[?]` detail. Keep load-bearing rules; examples live in `flow.md`, banner in `banner.txt`.

### `3)` Rewrite 03-present

> Render the screen assess chose, delegate the shape.

1. Rename `02-report.md` => `03-present.md`; render the screen named in the `02-assess` decision, filling `assets/report.md`.
2. Load `banner.txt` only on entry screens; `flow.md` only on flow/walk screens.
3. Every `⚠` renders with its plain cause and a fix action; unused tools omitted.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                       |
| ---- | ----------------------------------------------------------------------------------------- |
| 1    | `flow.md` lists all 8 steps with what/why and both layouts; both foundation paths present. |
| 2    | A rendered `⚠` line names the cause and offers a keyed fix; the framing line shows only on the first report. |
| 3    | An existing repo renders memory as foundation step 1 of 2; a greenfield renders the stack first. |
| 3    | The banner appears on entry screens only; a warning screen loads no `flow.md`.             |
