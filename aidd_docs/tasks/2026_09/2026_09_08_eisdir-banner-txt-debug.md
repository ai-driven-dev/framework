# Task [eisdir-banner-txt-debug]

Symptom: `Error: EISDIR: illegal operation on a directory, open '.../.vibe/skills/aidd-context-00-onboard/assets/banner.txt'` during `aidd framework build --target mistral --flat --force`.

## Hypotheses

- [x] H1 Leftover dirs from the Sep 3 mapper (`<file>/skill.md`, including non-md assets) sit on the new dest path. VALIDATED: commit `96f9175` wrote `.vibe/skills/${plugin}-${withoutSuffix}/skill.md`; on disk `banner.txt/` is a directory containing the banner ASCII in `skill.md`; 422 leftover `skill.md` vs 1 new `SKILL.md`.
- [x] H2 Current `stripToolSuffix` / `mistralFlatSkillPath` still wraps `.txt` as a skill folder. INVALIDATED: `mistralFlatSkillPath` is `genericFlatSkillPath` and keeps `assets/banner.txt` as a file. Source in `plugins/aidd-context/skills/00-onboard/assets/banner.txt` is a UTF-8 file.
- [x] H3 Vibe indexes every leaf and converts it in place to `<name>/skill.md`. INVALIDATED: Vibe `SkillManager._discover_skills_in_dir` only loads immediate children of `.vibe/skills/` that contain `SKILL.md`. No wrap. Error string is Node `EISDIR`, not Python `IsADirectoryError`.
- [x] H4 `--force` skips `checkCollision` then `FileAdapter.writeFile` → Node `open()` on the leftover directory. VALIDATED: reproduced `writeFileSync` → `EISDIR: illegal operation on a directory, open '.../banner.txt'`. Without `--force`, `fileExists` on a dir is true → `FlatTargetExistsError`, not EISDIR.
- [x] H5 Docker/git created an empty `banner.txt` directory. INVALIDATED: `banner.txt/skill.md` holds the AIDD ASCII banner (493 bytes), written 2026-09-08 12:19 by the old mapper, not an empty mount.

## Root cause

Old Mistral flat mapper wrapped every skill leaf as `<path-minus-.md>/skill.md`. For `banner.txt` it did not strip the extension, so dest is a directory. Current mapper writes `banner.txt` as a file. `--force` does not replace a directory, Node throws EISDIR.

## Next (done 2026-09-08)

`--force` now deletes a leftover dest directory before write (`checkCollision`). Rebuild can overwrite the Sep 3 wrap without a manual wipe. Same landmine covered for other non-md assets (`hook-template.json`, `config-template.json`, `locked-sets.json`).
