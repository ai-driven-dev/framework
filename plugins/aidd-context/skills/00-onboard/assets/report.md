<!-- The onboard report shape. Render in this order. Loud, scannable, beginner-clear. -->

🔍  <project name> — AIDD checkup

🏗️  Foundations
    <glyph> <deliverable>   <glyph> <deliverable>   ...   <!-- one per zone-1 check, ✅/⚠️/❌/➖; ⚠️ and ➖ carry a short parenthetical reason -->
🧩  Context artifacts (optional)
    <✓/✗ per artifact, inline>   <!-- collapse to "none yet" when every one is absent, see rules -->

🚦  Dev flow
    <track>   <!-- ✓ done · 📍 here · ◦ ahead, joined by " · "; add the held-back note when a foundation is unmet -->

✨  Do this next
    1.  <command>   <tier badge>   <plain-language purpose>
    ...

    ↳ <footer: what OK does in this state · a number for one · "explain <step>" · "explain project" (only when memory is filled) · stop>

<!--
Glyphs (two vocabularies, do not mix them):
- Checklist (a thing's health): ✅ present · ⚠️ present but off canonical shape · ❌ missing · ➖ not applicable (a check that does not apply to this project, e.g. stack design on an established repo).
- Dev-flow track (progress, not health): ✓ passed · 📍 the stage the project sits at · ◦ not reached. Never mark a future stage ❌; it is not broken, just ahead.

Tier badges (one per step, never combined): ⚡ auto · 💬 guided · 🖐 manual. Match the step's tier in checks.md.

Rules:
- Foundations show every zone-1 check as ✅/⚠️/❌/➖. A ⚠️ carries a one-clause reason in parentheses; a ➖ carries a short "why not applicable" note.
- Context artifacts are optional and info only: show the inline ✓/✗ row when at least one is present (it is real project context worth seeing); collapse to "🧩  Context artifacts — none yet (optional)" when all are absent, to cut noise on a bare repo. Never rank them into Do-this-next or the OK walk.
- Dev flow renders the full track every time so the user sees the whole path. While any foundation is unmet, mark every stage ◦, append "(starts once the foundations are in place)", and hold the dev-flow and health steps out of Do-this-next. Once the foundations are met, mark 📍 on the stage the project sits at, ✓ on passed stages, ◦ ahead.
- Health tools (add tests, debug, audit) enter Do-this-next after the dev-flow step, never above it, only when the foundations are met.
- Do-this-next: the command leads (it is what the user acts on), then its tier badge, then a plain-language purpose with no jargon. Every line resolves to an installed command or is named a gap by function, never an invented command.
- The footer is one line, never dropped, and states plainly what OK does in this exact state: which steps run on their own, which pause for input, which are left for the user. Name the count.
- No internal note names, raw zone labels, tier-internal names, or snapshot beyond the glyphs reach the user.
-->
