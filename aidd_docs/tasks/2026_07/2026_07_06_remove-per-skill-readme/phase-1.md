---
status: done
---

# Instruction: Remove per-skill READMEs and fix every reference

## Architecture projection

> ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/
│   ├── aidd-context/
│   │   ├── README.md                         ✏️ retarget 13 skill-table links -> SKILL.md
│   │   ├── CATALOG.md                         ✏️ regenerate (auto)
│   │   └── skills/*/README.md                 ❌ delete 13 (NOT assets/**/README.md)
│   ├── aidd-dev/
│   │   ├── README.md                         ✏️ retarget 11 skill-table links -> SKILL.md
│   │   ├── CATALOG.md                         ✏️ regenerate (auto)
│   │   └── skills/*/README.md                 ❌ delete 11
│   ├── aidd-orchestrator/{README,CATALOG}.md  ✏️ retarget / regenerate
│   │   └── skills/00-async-dev/README.md      ❌ delete 1
│   ├── aidd-pm/{README,CATALOG}.md            ✏️ retarget / regenerate
│   │   └── skills/*/README.md                 ❌ delete 4
│   ├── aidd-refine/{README,CATALOG}.md        ✏️ retarget / regenerate
│   │   └── skills/*/README.md                 ❌ delete 5
│   ├── aidd-ui/{README,CATALOG}.md            ✏️ retarget / regenerate
│   │   └── skills/01-hello/README.md          ❌ delete 1
│   └── aidd-vcs/{README,CATALOG}.md           ✏️ retarget / regenerate
│       └── skills/*/README.md                 ❌ delete 4
└── docs/CREATE_PLUGIN.md                       ✏️ drop per-skill README from structure + section, retarget links
```

Do NOT touch: `plugins/*/README.md` as skills (plugin-level, kept), the top-level framework `README.md`, or asset READMEs (`plugins/aidd-context/skills/02-project-memory/assets/README.md`, `.../assets/templates/memory/README.md`).

## Tasks to do

### `1)` Spot-check the 7 outlier READMEs before deleting

> 7 READMEs lack the breadcrumb header, so they may carry prose their SKILL.md does not. Merge unique content, then delete. Do not blind-delete these.

Outliers: `aidd-context/skills/{00-onboard,09-mermaid,10-learn,11-explore,12-cook}`, `aidd-ui/skills/01-hello`, `aidd-vcs/skills/00-repo-init`.

1. Diff each README against its sibling SKILL.md.
2. If the README holds substantive info absent from SKILL.md (e.g. `01-hello` documents an install prerequisite / `claude --plugin-dir` invocation), fold the essential line into the SKILL.md, matching that file's terse style.
3. Pure mirrors (heading + when-to/not-to that the SKILL description already states): nothing to merge.

### `2)` Delete the 39 per-skill READMEs

> Direct children of a skill directory only.

1. Remove every file matching `plugins/*/skills/*/README.md`.
2. Leave the two asset READMEs and all plugin-level / framework READMEs in place.

### `3)` Retarget the plugin-level README skill tables

> Each of the 7 `plugins/<plugin>/README.md` has a Skills table linking `skills/<x>/README.md`. Point them at `SKILL.md`.

1. In every `plugins/*/README.md`, replace `skills/<skill>/README.md` link targets with `skills/<skill>/SKILL.md`. Link text and table rows stay unchanged.

### `4)` Update `docs/CREATE_PLUGIN.md`

> The doc prescribes a per-skill README; drop that so the convention does not reintroduce them.

1. Remove the per-skill `README.md` entry from the structure diagram (keep the plugin-level `README.md` entry).
2. Remove or rewrite the `### skills/01-hello/README.md` section so it no longer instructs authors to ship a per-skill README; keep the plugin-level README guidance.
3. Retarget any `skills/<x>/README.md` link in the doc to `SKILL.md`.

### `5)` Regenerate the CATALOGs

> `CATALOG.md` is auto-generated; do not hand-edit. Regenerate so the README rows drop out.

1. For each plugin run `node scripts/summarize-markdown.js "plugins/<name>/" "plugins/<name>/CATALOG.md" --depth=4 --fields=description --title="<name> catalog" --tagline="Auto-generated index of skills, agents, references and assets shipped by the \`<name>\` plugin."` (identical to the `lefthook.yml` block), or let the pre-commit hook run it.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Each outlier's unique content is either merged into its SKILL.md or confirmed to be a pure mirror.          |
| 2    | `find plugins -path '*/skills/*/README.md'` returns zero results; both asset READMEs still exist.           |
| 3    | No `plugins/*/README.md` skill table links to a `skills/*/README.md`; all point to `SKILL.md`.              |
| 4    | `docs/CREATE_PLUGIN.md` no longer prescribes a per-skill README and links to no removed file.               |
| 5    | Regenerated `CATALOG.md` files list no `skills/*/README.md` row.                                            |
