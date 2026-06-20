<!-- Cited by upsert. The rules every recipe file follows. -->

# Recipe contract

Rules for every `recipes/<kebab-slug>.md` the skill writes.

## File

- Path: `recipes/<kebab-slug>.md`.
- The recipe opens with the H1 title, then one plain sentence of description — no "Goal:" label, no blockquote, no metadata table.

## Writing

- One idea per sentence. Prefer removing over adding.
- No filler line under a heading (no "Ranked by impact", "Start at the top", and the like).
- `## Why`: short and benefit-first, one idea per line. Lead with the keywords a reader would search, **bold** the key terms.

## Steps

- The steps section heading is named after the goal: `## Steps to <outcome>`, never a bare `## Steps`.
- One step = one action: never bundle several tools or commands under one heading; split them.
- Each step is a `#### N) <emoji> Title` heading: it opens with an emoji, then one benefit-focused line of what and why. Number steps continuously.
- How-bullets are straight to the point and ordered for action. For a tool: where it is, then install it from its URL, then how to use it.
- Every step carries one concrete example. Prefer an image — a screenshot or short video/GIF that matches the action — over text whenever one exists; for a tool, use its official screenshot. Otherwise: a command with its real output (show what it prints, not just the command), or a config or snippet.
- Level subheadings are optional. Group steps under `### 🟢 Beginner`, `### 🟡 Intermediate`, `### 🔴 Expert` only when the recipe spans difficulty levels and grouping helps the reader; a short or single-level recipe lists its steps directly. Include only the levels that have a step.
- Link to a reference when applicable.
