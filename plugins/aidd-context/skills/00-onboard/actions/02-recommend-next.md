# 02 - Recommend next

Render the project briefing header and the hub menu, route the user's choice down to a single concrete action, and hand it to `03-execute-or-handoff`. The user sees only clean briefing text and numbered menus - never a raw snapshot, never an `Analysis:` label.

## Inputs

- Internal working state from `actions/01-detect-state.md` (held in conversation context, not printed).

## Outputs

### The hub render

```text
Project: <name> - <stack, or "no stack detected">
AIDD setup: memory bank <absent|placeholder|filled>, context block <present|missing>
Standing: <one plain-language line derived from sdlc_phase>

What do you want to do?
  1. Understand this project
  2. Memory bank - <set up | refresh>
  3. Continue the SDLC
  4. List every installed surface
  5. Stop

Suggested: <N> - <one short reason>. Reply with a digit between 1 and 5.
```

### The SDLC sub-menu - rendered on hub option 3

```text
Standing: <sdlc_phase as a one-line hint, e.g. "source code is present - you could be mid-build or ready to review">

Where do you want to work?
  1. Clarify a raw idea
  2. Write user stories, a PRD, or a spec
  3. Produce a technical plan
  4. Implement a feature
  5. Review code or feature behavior
  6. Commit, open a pull request, or release
  7. Back to the hub menu

Reply with a digit between 1 and 7.
```

### The skill menu - rendered after a category resolves to a skill

```text
Next: <skill name> - <one-line purpose>

  1. Run it now in this session
  2. Explain what it will do, then ask again
  3. Hand off: tell me the command to run in a new session
  4. Pick a different option
  5. Stop the onboard loop

Reply with a digit between 1 and 5.
```

## Process

1. **Read the internal state from 01.** Print nothing from it directly. No `state:` block, no signal dump.
2. **Render the hub.** The three-line briefing header in clean prose - no `Analysis:` label - then the 5-option menu, then the one-line suggested-option marker and the digit prompt. The `Standing` line turns `sdlc_phase` into plain language, never a raw enum value.
3. **Wait for a digit.** Free text -> re-render the hub unchanged plus `Reply with a digit between 1 and 5.`
4. **Route the pick.** Each route that resolves a skill records `origin_menu` - `hub` for picks made on the hub, `sdlc` for picks made on the SDLC sub-menu.
   - `1` -> hand to 03 with `action=briefing`.
   - `2` -> resolve the memory category: `bootstrap` if the repo is greenfield, `context-setup` if `memory_state` is `absent` or `placeholder`, `memory-upkeep` if `filled`. Resolve it to a skill, render the skill menu. `origin_menu=hub`.
   - `3` -> render the SDLC sub-menu. On a leg pick (1 to 6), resolve the category to a skill and render the skill menu with `origin_menu=sdlc`. On `7`, re-render the hub.
   - `4` -> resolve `discovery`, render the skill menu. `origin_menu=hub`.
   - `5` -> hand to 03 with `action=stop`.
5. **Resolve categories** per the matrix `Category resolution` rules. A gap -> replace the `Next:` line with `This action needs an AIDD plugin that is not installed: <function>.` and offer only explain / swap / stop. Never name a skill id or plugin id that is not installed.
6. **`only_aidd_context`.** When the user opens the SDLC sub-menu and its legs resolve to gaps, add once: `Only the context layer is installed. The legs refine, specify, plan, implement, review, and ship unlock when their AIDD plugins are added.`
7. **Wait for the skill-menu reply**, then hand to 03 with `{ action: run|explain|handoff|swap|stop, skill, category, origin_menu }`. Skill-menu option 4 (`Pick a different option`) maps to `action=swap`.
8. **Challenge conflicting picks.** If the user picks an SDLC leg that needs setup not yet done, surface the conflict in one sentence (`Detected state suggests setting up X first. Continue anyway?`) before complying.
9. **Wait for an explicit reply at every menu.** Do not auto-advance.

## Test

- No raw snapshot, `state:` block, or `Analysis:` label ever appears. The first user-visible output is the three-line briefing header.
- The hub always renders 5 options and exactly one suggested marker.
- Hub option 3 renders the 7-option SDLC sub-menu; option 7 returns to the hub.
- A category with no matching installed skill renders the gap line, never a skill id or foreign plugin id.
- Free-text input at any menu re-renders that menu plus a digit reminder.
- The `Standing` line is plain language, never a raw `sdlc_phase` enum value.
