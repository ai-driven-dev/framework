# Review: improve conversation skill

- **Verdict**: changes-requested
- **Diff**: `HEAD...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_03
- **Findings**: 0 critical, 4 warning, 0 minor

## Phases

### Phase 1 — Read conversation

- [x] Require one exact complete conversation and stop when unavailable — plugins/aidd-refine/skills/05-improve/actions/01-read-conversation.md:15
- [x] Route Codex, Claude Code, and OpenCode sources by exact session — plugins/aidd-refine/skills/05-improve/assets/conversation-sources.md:5
- [x] Report visible wall time, tool time, unattributed wait, and evidence without claiming reasoning time — plugins/aidd-refine/skills/05-improve/actions/01-read-conversation.md:19
- [ ] Exclude prior `improve` runs reliably on every rerun — reports have no stable marker or identification rule

### Phase 2 — Recommend

- [x] Answer all five improvement questions from conversation evidence — plugins/aidd-refine/skills/05-improve/actions/02-recommend.md:15
- [x] Assess skill, behavior, and documentation separately — plugins/aidd-refine/skills/05-improve/actions/02-recommend.md:21
- [x] Verify named files before declaring them stale or unclear — plugins/aidd-refine/skills/05-improve/actions/02-recommend.md:23
- [x] Merge duplicates and use a stable recommendation order — plugins/aidd-refine/skills/05-improve/actions/02-recommend.md:24

### Phase 3 — Target edits

- [x] Resolve `target-edits` through a matching action filename — plugins/aidd-refine/skills/05-improve/actions/03-target-edits.md:1
- [x] Render a simple file addition/removal table, not a Git diff — plugins/aidd-refine/skills/05-improve/actions/03-target-edits.md:11
- [x] Ask the exact cumulative-improvement question last — plugins/aidd-refine/skills/05-improve/actions/03-target-edits.md:19

### Phase 4 — Orchestrate

- [x] Run all three actions without intermediate confirmation — plugins/aidd-refine/skills/05-improve/SKILL.md:28
- [x] Stop only when a complete transcript cannot be resolved — plugins/aidd-refine/skills/05-improve/actions/01-read-conversation.md:16
- [x] Avoid project edits and any learn handoff — plugins/aidd-refine/skills/05-improve/SKILL.md:32

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | 1 | plugins/aidd-refine/skills/05-improve/SKILL.md:30 | Idempotence depends on recognizing prior invocations and reports, but emitted reports have no stable marker and natural-language invocations may have no `/improve` token. | Emit a fixed report marker or heading and exclude turns carrying that marker. |
| 🟡 warning | code | 1 | plugins/aidd-refine/skills/05-improve/actions/01-read-conversation.md:18 | Every tool result may be read and evidence rendered without a redaction rule; Codex and Claude exports can contain credentials or private file content. | Redact secrets and sensitive payloads before rendering evidence. |
| 🟡 warning | conform | 2 | plugins/aidd-refine/skills/05-improve/SKILL.md:3 | `improve` excludes delivery review, but `challenge` still triggers on any critical review of recent work; the naming contract rejects overlapping trigger phrases. | Restrict `challenge` away from conversation retrospectives, timing, and token efficiency. |
| 🟡 warning | fit | 1 | plugins/aidd-refine/skills/05-improve/assets/conversation-sources.md:9 | The OpenCode fallback hardcodes legacy project storage although current CLI exposes `opencode db path` and OpenCode v2 uses `~/.local/share/opencode/opencode.db`. | Prefer `opencode db path`; branch explicitly for v2 before direct storage access. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 93% (13/14) |
| Files checked | README.md, docs/ARCHITECTURE.md, plugins/aidd-refine/.claude-plugin/plugin.json, plugins/aidd-refine/CATALOG.md, plugins/aidd-refine/README.md, plugins/aidd-refine/skills/02-challenge/SKILL.md, plugins/aidd-refine/skills/05-improve/SKILL.md, plugins/aidd-refine/skills/05-improve/actions/01-read-conversation.md, plugins/aidd-refine/skills/05-improve/actions/02-recommend.md, plugins/aidd-refine/skills/05-improve/actions/03-target-edits.md, plugins/aidd-refine/skills/05-improve/assets/conversation-sources.md |
| Unchecked     | Exclude prior `improve` runs reliably on every rerun — fix |
| Unplanned     | none |
