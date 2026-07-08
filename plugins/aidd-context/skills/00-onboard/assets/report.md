<!-- Onboard report shape. Emoji-anchored state on top, one recommended action with its key, compact options, full detail only on demand. Render top to bottom. -->

<framing line>   <!-- first report of the session only, dropped on re-scans: "Interactive checkup — nothing runs until you reply." -->

🔍  <state sentence>   <!-- one plain line naming where the project stands; see State -->

🏗️  Foundations   <compact status; per-check ✅/⚠️/❌ only when it fits, else in [?]>
🚦  Progress       <the dev-flow path with the current stage in [brackets], or a plain setup/idle note>

👉  Next: <plain action>   [1]
    <compact options line: remaining steps as key-labelled chips, then [OK] when it walks, then [?]>

<!--
Keys: the user replies with a bracketed token. [1] [2]… run a step, [OK] walks the pending steps in order, [?] expands the full detail. State the keys inline; never a standalone "type N and press Enter" line.

Glyphs, only in the dashboard rows: ✅ done · ⚠️ needs fixing · ❌ missing. Progress marks the current stage with [brackets], never 📍/◦/➖.

Tier shows only inside [?], as a plain clause: AUTO "(runs on its own)", GUIDED "(it will ask you a few questions)", MANUAL "(you run this one yourself)". It is the step's default, overridable (see run-tiers.md).

Rules:
- Framing: the first report of the session only, then dropped on re-scans, so the user knows it is an interactive checkup they drive.
- State (🔍): one plain sentence, no jargon. Greenfield → "Not set up yet — let's lay the foundations." A foundation off-shape → "Almost set up — one thing needs fixing." Mid-work → "Healthy — unsaved changes in progress." (or "…ready to review" / "…ready to ship" per the stage). Idle → "Healthy — ready for new work."
- Foundations (🏗️): a compact status ("✅ all set" · "❌ 0 of 3 done" · "⚠️ needs attention: <which>"). Move the per-check ✅/⚠️/❌ into [?] when it would crowd the line.
- Progress (🚦): the dev-flow path with the current stage in [brackets] (spec → plan → [build] → review → ship); "[setup] → dev flow opens after" while foundations are unmet; "nothing in progress" when idle.
- Next (👉): the single top-ranked step per checks.md in plain words with its key [1]. The rest on one compact line as key-labelled chips, then [OK] when it walks the pending steps, then [?]. Command ids never appear here.
- Idle menu (checks.md rank 4): "Next: start new work [1]", then "improve the project [2] · customize the AI [3] · explore [?]". Slots 2 and 3 are umbrellas: picking one re-renders its installed member sub-list to pick from. No [OK] when the list is only the idle menu.
- [?] detail: on request, the full view — each step's command id and tier clause, the per-check foundation reasons, and the read-only extras (explain project only when memory is filled, recap only when a prior conversation exists, stop).
-->
