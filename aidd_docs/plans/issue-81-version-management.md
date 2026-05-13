---
objective: Unify version management across the marketplace and all six plugins via release-please in the aidd-framework monorepo, so every plugin (including aidd-orchestrator and aidd-refine) is a first-class release-please package, the manifest aligns with current plugin.json values, the root tracks marketplace.json at 4.0.0, CI no longer references the removed version.txt, and the contribution docs explain which commit scope bumps what.
success_condition: |
  All of the following hold simultaneously:
    1. `jq '.packages | keys | sort' release-please-config.json` outputs `["." ,"plugins/aidd-context","plugins/aidd-dev","plugins/aidd-orchestrator","plugins/aidd-pm","plugins/aidd-refine","plugins/aidd-vcs"]`.
    2. Every plugin entry under `.packages` in release-please-config.json (except aidd-pm, which keeps `release-as: 1.0.0-rc.1`) has `package-name` and an `extra-files` block pointing at `.claude-plugin/plugin.json` `$.version` (json type).
    3. `jq -S . .release-please-manifest.json` equals exactly:
         {
           ".": "4.0.0",
           "plugins/aidd-context": "1.0.0",
           "plugins/aidd-dev": "1.0.0",
           "plugins/aidd-orchestrator": "1.0.0",
           "plugins/aidd-pm": "1.0.0-rc.1",
           "plugins/aidd-refine": "1.0.0",
           "plugins/aidd-vcs": "1.0.0"
         }
       and each version equals the `version` field inside the matching `plugins/<name>/.claude-plugin/plugin.json`.
    4. `grep -n "version.txt" .github/workflows/ci.yml` returns no matches.
    5. CI builds per-plugin tarballs only when the matching `release-please` per-package `release_created` output is true, and the root framework tarball only when the root `.` `release_created` is true. The job that previously produced `aidd-framework-<version>.tar.gz` no longer includes `version.txt` in its file list.
    6. `commitlint.config.cjs` `scope-enum` accepts `aidd-orchestrator`, `aidd-refine`, and `marketplace` (already true today; verified, not regressed) and a sample run `echo "feat(marketplace): test" | pnpm exec commitlint` exits 0 (same for `aidd-orchestrator` and `aidd-refine` scopes).
    7. CONTRIBUTING.md "Commit scope discipline" section lists all seven valid scopes (`aidd-context`, `aidd-dev`, `aidd-vcs`, `aidd-pm`, `aidd-orchestrator`, `aidd-refine`, `framework`, `marketplace`) with a one-line rule for which target each scope bumps.
iteration: 0
created_at: 2026-05-13
---

# Issue #81 — Unify version management via release-please

## Context (verified against working tree)

Read at planning time. Do not trust this section without re-reading the files in Phase 0.

- `release-please-config.json` registers only `.` (root), `plugins/aidd-context`, `plugins/aidd-dev`, `plugins/aidd-vcs`, `plugins/aidd-pm`. `aidd-orchestrator` and `aidd-refine` are missing.
- `.release-please-manifest.json` currently contains:
  ```
  { ".": "3.9.1", "plugins/aidd-context": "1.0.0", "plugins/aidd-dev": "1.0.0",
    "plugins/aidd-vcs": "1.0.0", "plugins/aidd-pm": "1.0.0-rc.1" }
  ```
  Root is `3.9.1` but `.claude-plugin/marketplace.json` is `4.0.0`. `aidd-orchestrator` and `aidd-refine` missing.
- All six `plugins/*/.claude-plugin/plugin.json` files exist. Current versions: context/dev/vcs/orchestrator/refine = `1.0.0`; pm = `1.0.0-rc.1`.
- `marketplace.json` already lists all six plugins. No edits needed there.
- `commitlint.config.cjs` already includes `aidd-orchestrator`, `aidd-refine`, and `marketplace` in `scope-enum`. AC #3 and AC #6 in the issue describe the **target** state, which the file already satisfies. The plan must verify-and-preserve, not edit.
- `.github/workflows/ci.yml` line 89 includes `version.txt` in the source tarball. `version.txt` does not exist at repo root. The whole build/attach job assumes a single `release-please` output (root version) — it does not consume per-package outputs.
- `scripts/build-dist.sh` is out of scope (constraint).
- `aidd-pm` keeps `release-as: 1.0.0-rc.1` (constraint).
- No plugin component tags exist in git history (only root `v*` and `v4.1.0-beta.*`). Safe to introduce component tags going forward; no retro-tagging.
- `release-please-config.json` has `include-component-in-tag: true` and `include-v-in-tag: true`. New plugin tags will be `<plugin>-v<X.Y.Z>` (e.g. `aidd-orchestrator-v1.0.0`); root tag remains `v<X.Y.Z>`.

## M / C / D — Must / Could / Do-not

### Must

- M1. Register `plugins/aidd-orchestrator` and `plugins/aidd-refine` in `release-please-config.json` with the same shape as `aidd-context` / `aidd-dev` / `aidd-vcs` (no `release-as`).
- M2. Update `.release-please-manifest.json` to: root `.` = `4.0.0`; add `plugins/aidd-orchestrator: 1.0.0` and `plugins/aidd-refine: 1.0.0`; keep the other four entries; final file has exactly 7 keys; every value matches the matching `plugin.json` (or `marketplace.json` for `.`).
- M3. Remove `version.txt` from `.github/workflows/ci.yml`.
- M4. Convert the `build-and-attach` job to consume per-package release-please outputs. The action emits `${{ steps.release.outputs.<path>--release_created }}` and `<path>--version`/`<path>--tag_name` per registered package (release-please-action v4 standard outputs). Use those to (a) attach root framework + per-tool tarballs only on root release, (b) attach per-plugin tarballs only on the corresponding plugin release. At minimum the root flow must still work; per-plugin tarballs can be a stub that no-ops cleanly when no plugin component was released. The job must not fail when only a plugin (and not root) is released, or vice-versa.
- M5. Update `CONTRIBUTING.md` "Commit scope discipline" table to document all seven scopes and which target each bumps. Add `aidd-orchestrator`, `aidd-refine`, and `marketplace` rows. Keep existing rows.
- M6. Verify `commitlint.config.cjs` still accepts `aidd-orchestrator`, `aidd-refine`, and `marketplace` (already true). If a future commit in this PR series removes any of them, restore them.

### Could

- C1. Add a smoke-test workflow step (or local script) that runs `npx release-please manifest-pr --dry-run` to validate config + manifest parse.
- C2. Add a CONTRIBUTING.md note clarifying that plugin components produce `<plugin>-v<version>` tags and the root produces `v<version>`.
- C3. Replace the now-stale "tarball contains version.txt" sentence in CONTRIBUTING.md Releases section with the actual file list.

### Do not

- D1. Do not edit `scripts/build-dist.sh`.
- D2. Do not change `aidd-pm` versioning (`release-as: 1.0.0-rc.1` stays).
- D3. Do not retro-tag any plugin component (no `aidd-orchestrator-v1.0.0` tag creation in git).
- D4. Do not create or restore a `version.txt` file.
- D5. Do not change `.claude-plugin/marketplace.json`; the root `.` package's `extra-files` already keeps it in sync via release-please.
- D6. Do not invent new scope names beyond the issue's list (`aidd-orchestrator`, `aidd-refine`, `marketplace`).
- D7. Do not alter `release-type`, `include-component-in-tag`, or `include-v-in-tag` in `release-please-config.json`.

## Rules table

| Rule | Where it applies | What it forbids / requires |
| --- | --- | --- |
| Component tags only forward | git history | Never write a tag whose component is a plugin name (release-please will do this on the next release). No manual `git tag <plugin>-v...`. |
| Manifest = source of truth on next release | `.release-please-manifest.json` | The manifest version for each path must match the `version` field in that path's `plugin.json` (or `marketplace.json` for `.`) at the moment of the PR merging. Drift will cause release-please to "bump from manifest", not from the file. |
| Per-package output naming | `.github/workflows/ci.yml` | Use `steps.release.outputs['<path>--release_created']` (release-please-action v4 syntax) — bracket form, not dot form, because path contains slashes. |
| Scope-to-target mapping | every commit going forward | `aidd-orchestrator` → `plugins/aidd-orchestrator/`; `aidd-refine` → `plugins/aidd-refine/`; `marketplace` → `.claude-plugin/marketplace.json` and cross-cutting marketplace metadata only. `framework` stays for root build/CI/docs. |
| One scope per commit | every commit | Cross-plugin work must split into separate commits. Pre-existing rule; preserved. |
| No source code modification by Planner | this PR | Plan only; Implementer makes the edits. |

## Phases

Five phases. Each phase is one Implementer pass with concrete acceptance criteria and a validation command list the Reviewer runs.

### Phase 1 — Register the two missing plugins and sync the manifest

Scope of edits:
- `release-please-config.json`
- `.release-please-manifest.json`

Tasks:
1. In `release-please-config.json`, inside `"packages"`, add two entries after `plugins/aidd-pm`:
   - `"plugins/aidd-orchestrator"`: `package-name: "aidd-orchestrator"`, `extra-files: [{ "type": "json", "path": ".claude-plugin/plugin.json", "jsonpath": "$.version" }]`. No `release-as`.
   - `"plugins/aidd-refine"`: `package-name: "aidd-refine"`, same `extra-files` shape. No `release-as`.
2. Confirm `aidd-pm` entry retains `"release-as": "1.0.0-rc.1"`.
3. Rewrite `.release-please-manifest.json` to exactly seven keys (sorted alphabetically for readability) with values:
   - `.` → `4.0.0`
   - `plugins/aidd-context` → `1.0.0`
   - `plugins/aidd-dev` → `1.0.0`
   - `plugins/aidd-orchestrator` → `1.0.0`
   - `plugins/aidd-pm` → `1.0.0-rc.1`
   - `plugins/aidd-refine` → `1.0.0`
   - `plugins/aidd-vcs` → `1.0.0`
4. Cross-check each value against `plugins/<name>/.claude-plugin/plugin.json` `version` and against `.claude-plugin/marketplace.json` `version` for `.`. Abort if any drift.

Acceptance criteria:
- `jq '.packages | keys | length' release-please-config.json` = 7.
- The two new package entries deep-equal the shape of `plugins/aidd-context` minus the `package-name` value.
- Running this comparison succeeds for every path (use a small loop, not a hand-edit per file):
  ```
  jq -r 'to_entries[] | "\(.key)=\(.value)"' .release-please-manifest.json | \
    while IFS='=' read -r path ver; do
      if [ "$path" = "." ]; then
        actual=$(jq -r '.version' .claude-plugin/marketplace.json)
      else
        actual=$(jq -r '.version' "$path/.claude-plugin/plugin.json")
      fi
      [ "$ver" = "$actual" ] || { echo "DRIFT: $path manifest=$ver file=$actual"; exit 1; }
    done && echo OK
  ```

Validation commands the Reviewer runs:
- `jq -e '.packages["plugins/aidd-orchestrator"].extra-files[0].path == ".claude-plugin/plugin.json"' release-please-config.json`
- `jq -e '.packages["plugins/aidd-refine"].extra-files[0].jsonpath == "$.version"' release-please-config.json`
- `jq -e '.["."] == "4.0.0" and (.["plugins/aidd-orchestrator"]) == "1.0.0" and (.["plugins/aidd-refine"]) == "1.0.0"' .release-please-manifest.json`
- The drift loop above prints `OK`.
- `git diff --stat` shows only the two files changed.

Expected commit boundary: one commit, `feat(framework): register aidd-orchestrator and aidd-refine in release-please and sync manifest to 4.0.0`.

Dependencies: none.

### Phase 2 — Strip `version.txt` from CI, prove the workflow still parses

Scope of edits:
- `.github/workflows/ci.yml`

Tasks:
1. Remove the literal `version.txt` line inside the `Build source tarball` step.
2. Leave the rest of that step untouched in this phase (per-package output rewiring happens in Phase 3, to keep diffs reviewable).
3. Run a YAML lint sanity check.

Acceptance criteria:
- `grep -c 'version.txt' .github/workflows/ci.yml` = 0.
- File still parses as valid YAML.

Validation commands:
- `grep -n 'version.txt' .github/workflows/ci.yml ; test $? -eq 1`
- `python -c 'import yaml,sys; yaml.safe_load(open(".github/workflows/ci.yml"))' && echo OK`

Expected commit: `ci(framework): drop version.txt from source tarball`.

Dependencies: none (independent of Phase 1, but ordered after for clean history).

### Phase 3 — Wire per-package release-please outputs in the build/attach job

Scope of edits:
- `.github/workflows/ci.yml`

Tasks:
1. In the `release-please` job, expose per-package outputs explicitly (release-please-action v4 emits them automatically as `steps.release.outputs['<path>--release_created']`, `'<path>--version'`, `'<path>--tag_name'`). Mirror them as named job outputs for ergonomic downstream use:
   - `root_release_created`, `root_version`, `root_tag`
   - `<plugin>_release_created`, `<plugin>_version`, `<plugin>_tag` for each of the six plugin paths.
2. Update the `build-and-attach` job condition so it runs when **any** of the seven release-created outputs is true (use `||` chain), not only the root one.
3. Split the build steps into two logical branches guarded by `if:`:
   - Root branch: runs only when `root_release_created == 'true'`. Produces `aidd-framework-${ROOT_VERSION}.tar.gz` and the per-tool tarballs (`aidd-claude-*`, `aidd-cursor-*`, `aidd-copilot-*`, `aidd-codex-*`) as today, minus `version.txt`. Uploads them to the root release tag (`root_tag`).
   - Plugin branch: a step (or matrix) iterates over the six plugin slugs. For each, when `<plugin>_release_created == 'true'`, packs the plugin directory into `<plugin>-<plugin_version>.tar.gz` and uploads it to that plugin's tag (`<plugin>_tag`). When false, the step is skipped.
4. Decision (recorded below): keep the per-plugin tarball as a minimal `tar czf -C plugins/<plugin> .` archive. It mirrors what an end-user would unpack into their own `plugins/<plugin>/` slot. Rationale: matches the marketplace `source: ./plugins/<plugin>` convention; avoids inventing a new layout.
5. Decision (recorded below): use a matrix strategy keyed on plugin slug with a per-job `if:` that reads the corresponding `needs.release-please.outputs.<plugin>_release_created`. Rationale: simplest static fan-out, no dynamic JSON parsing in shell.

Acceptance criteria:
- `release-please` job exposes 21 outputs (7 paths × 3 fields) — or, if fewer are needed downstream, at minimum the 7 `release_created` and 7 `tag_name` outputs.
- `build-and-attach`'s root steps are gated by `if: needs.release-please.outputs.root_release_created == 'true'`.
- The plugin-tarball step is gated per-plugin and uploads only to the matching `<plugin>-v<version>` tag.
- No reference to `version.txt` anywhere in the workflow.
- `python -c 'import yaml; yaml.safe_load(open(".github/workflows/ci.yml"))'` succeeds.

Validation commands:
- `grep -nE 'release_created|tag_name' .github/workflows/ci.yml` shows per-package output bindings, not only `release_created`/`tag_name` alone.
- `yamllint .github/workflows/ci.yml` (if available) reports no errors. Otherwise the python parse above is the gate.
- Optional dry-run: trigger the workflow on a throwaway branch and confirm both `release_created=false` paths skip cleanly.

Expected commit: `ci(framework): wire per-package release-please outputs for plugin and root tarballs`.

Dependencies: Phase 1 (config defines the seven packages whose outputs we now consume), Phase 2 (we don't want to undo the version.txt removal).

### Phase 4 — Document the scope rules

Scope of edits:
- `CONTRIBUTING.md`

Tasks:
1. Replace the existing "Commit scope discipline" table with a seven-row version covering all valid scopes. Required rows (in this order):
   - `aidd-context` → Changes inside `plugins/aidd-context/`
   - `aidd-dev` → Changes inside `plugins/aidd-dev/`
   - `aidd-vcs` → Changes inside `plugins/aidd-vcs/`
   - `aidd-pm` → Changes inside `plugins/aidd-pm/`
   - `aidd-orchestrator` → Changes inside `plugins/aidd-orchestrator/`
   - `aidd-refine` → Changes inside `plugins/aidd-refine/`
   - `marketplace` → Changes to `.claude-plugin/marketplace.json` and marketplace-level metadata
   - `framework` → Root-level: build scripts, CI, config, docs, `aidd_docs/`
2. Add one paragraph immediately after the table explaining the bump effect: "Each scope maps to a release-please package. A `feat(aidd-refine):` commit bumps `plugins/aidd-refine/.claude-plugin/plugin.json` and creates an `aidd-refine-v<X.Y.Z>` tag. A `feat(framework):` or `feat(marketplace):` commit bumps the root, which updates `.claude-plugin/marketplace.json` and creates a `v<X.Y.Z>` tag."
3. Update the Releases section to drop the `version.txt` mention and reflect the new tarball list (root tarball + per-tool tarballs + per-plugin tarballs).
4. Preserve the existing "Cross-plugin changes must be split into separate commits" line.

Acceptance criteria:
- The scope table has exactly the eight rows listed (7 valid scopes plus the `framework` baseline; treat `marketplace` and `framework` as distinct).
- The word `version.txt` no longer appears in `CONTRIBUTING.md`.
- The bump-mapping paragraph names at least one plugin scope and the root scope explicitly.

Validation commands:
- `grep -c '^| ' CONTRIBUTING.md | head -1` reflects the expanded table (sanity check, not a hard equality).
- `grep -n 'version.txt' CONTRIBUTING.md ; test $? -eq 1`
- `grep -nE 'aidd-orchestrator|aidd-refine|marketplace' CONTRIBUTING.md` shows the new rows.

Expected commit: `docs(framework): document scope rules for all six plugins and the marketplace`.

Dependencies: none (could be done in parallel with Phase 2/3, but commit it after for cleaner history).

### Phase 5 — Verify commitlint and run the integrated check

Scope of edits: none expected. This phase is verification + a remediation hook if a regression slipped in.

Tasks:
1. Verify `commitlint.config.cjs` `scope-enum` still includes `aidd-orchestrator`, `aidd-refine`, `marketplace`. If yes, no edit. If no (regression introduced by an earlier phase), restore them.
2. Run the end-to-end success_condition assertions from the frontmatter.

Acceptance criteria (all must pass):
- `jq -e '.packages | keys | sort == ["." ,"plugins/aidd-context","plugins/aidd-dev","plugins/aidd-orchestrator","plugins/aidd-pm","plugins/aidd-refine","plugins/aidd-vcs"]' release-please-config.json`.
- The manifest deep-equals the target object listed in `success_condition.3`.
- `grep -n 'version.txt' .github/workflows/ci.yml ; test $? -eq 1` and the same in `CONTRIBUTING.md`.
- `node -e "const c=require('./commitlint.config.cjs'); const e=c.rules['scope-enum'][2]; for (const s of ['aidd-orchestrator','aidd-refine','marketplace']) if (!e.includes(s)) { console.error('missing '+s); process.exit(1); } console.log('OK')"`.
- `printf "feat(marketplace): test\n" | pnpm exec commitlint` exits 0. Repeat for `aidd-orchestrator` and `aidd-refine`.
- `CONTRIBUTING.md` lists the seven scopes.
- A dry-run of release-please (if a token is available locally) does not error on config parse. If no token: `node -e "JSON.parse(require('fs').readFileSync('release-please-config.json'))"` and same for the manifest must succeed.

Validation commands: all of the above.

Expected commit boundary: `chore(framework): verify commitlint scopes for new packages` only if a fix was needed; otherwise no commit.

Dependencies: Phases 1–4.

## Architecture (high-level)

```
release-please-config.json  ──┐                       ┌── plugins/aidd-context/.claude-plugin/plugin.json
                              │                       │   plugins/aidd-dev/.claude-plugin/plugin.json
.release-please-manifest.json │── release-please ────►│   plugins/aidd-vcs/.claude-plugin/plugin.json
                              │   (per-package        │   plugins/aidd-pm/.claude-plugin/plugin.json   (release-as 1.0.0-rc.1)
.claude-plugin/marketplace.json│   outputs)           │   plugins/aidd-orchestrator/.claude-plugin/plugin.json   ◄── NEW
                              │                       │   plugins/aidd-refine/.claude-plugin/plugin.json         ◄── NEW
                              │                       └── .claude-plugin/marketplace.json (root extra-file)
                              ▼
                .github/workflows/ci.yml
                ├── release-please job (exposes 7 × {release_created, version, tag_name})
                └── build-and-attach job
                    ├── if root_release_created: framework tarball + per-tool tarballs
                    └── matrix per plugin: if <plugin>_release_created: <plugin> tarball
```

Tags produced:
- Root: `v<X.Y.Z>` (also drives `marketplace.json` version).
- Each plugin: `<plugin>-v<X.Y.Z>` (e.g. `aidd-orchestrator-v1.0.1`).

## Decisions made (recorded)

| ID | Topic | Decision | Rationale |
| --- | --- | --- | --- |
| 1 | Initial versions for newly-registered plugins | `aidd-orchestrator: 1.0.0`, `aidd-refine: 1.0.0` | Matches the spec's manifest target and the current `plugin.json` values; no retro-tagging implied. |
| 2 | Root sync to `4.0.0` | Adopt the value already present in `.claude-plugin/marketplace.json` rather than rolling back the marketplace | Spec requires sync to 4.0.0; marketplace.json is the public-facing source of truth via the existing `extra-files` link. |
| 3 | Per-plugin tarball shape | `tar czf <plugin>-<version>.tar.gz -C plugins/<plugin> .` | Mirrors `source: ./plugins/<plugin>` in `marketplace.json`; consumers unpack directly into their own `plugins/<plugin>/`. Avoids inventing layout. |
| 4 | CI fan-out strategy | Matrix on plugin slug with per-matrix-job `if:` guarded by `needs.release-please.outputs.<plugin>_release_created` | Static, readable; no dynamic JSON parsing in shell. |
| 5 | `commitlint.config.cjs` already lists `aidd-orchestrator`, `aidd-refine`, `marketplace` | Verify and preserve, do not re-edit | Avoids a no-op diff and reflects ground truth: ACs #3 and #6 are already satisfied. |
| 6 | `aidd-pm` versioning | Untouched, keeps `release-as: 1.0.0-rc.1` | Explicit constraint in the issue. |
| 7 | No retro-tagging | No `git tag aidd-orchestrator-v1.0.0` etc. | Explicit constraint; release-please will create component tags on the next bump for each plugin organically. |
| 8 | Phase ordering | Config → CI cleanup → CI per-package wiring → docs → verify | Keeps each diff small and reviewable; CI wiring can rely on config being already in place. |
| 9 | `marketplace` vs `framework` scope | Keep both, with `marketplace` reserved for marketplace.json/metadata-only commits | The repo already accepts both in `scope-enum`; documenting the split clarifies intent for contributors. |

## Decisions blocked

None. All scope decisions resolvable from the spec and the verified repo state.

## Notes for the next iteration

- The release-please-action v4 output naming uses double-dash between path and field (e.g. `plugins/aidd-orchestrator--release_created`). Implementer must use the bracket-access form in workflow expressions because `/` in the path breaks dot access.
- If the Implementer finds the matrix syntax with per-job `if:` reading dashed-keyed outputs awkward, falling back to a single bash step that loops over plugin slugs and uses `gh release upload` per slug is acceptable. Record that as a Phase 3 deviation if taken.
- Reviewer should confirm that no existing beta-tag flow (`v4.1.0-beta.*`) is broken by the per-package output wiring. The beta-tag flow is not in scope here, but a regression would surface as the root release branch ceasing to produce tarballs.
- If a future change wants to give `marketplace`-scoped commits their own bump path (separate from `framework`), that requires a new release-please package entry mapped to `.claude-plugin/`. Out of scope for this issue but flagged for follow-up.
