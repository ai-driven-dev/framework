---
status: done
---

# Instruction: Convert Existing Skill READMEs

Part of [`plan.md`](./plan.md).

## Architecture projection

```txt
plugins/
  aidd-*/
    README.md
    skills/
      <skill>/
        README.md -> ../../README.md
        SKILL.md
        actions/
        references/
        assets/
          README.md          # unchanged when present
```

## Tasks to do

### `1)` Inventory direct skill README files

> Build the exact direct-skill README target list without accidentally including nested asset/template READMEs.

1. Use a filesystem-depth scan for `plugins/<plugin>/skills/<skill>/README.md`.
2. Confirm each owning `plugins/<plugin>/README.md` exists.
3. Record any direct skill README that is already a symlink and preserve it if it resolves correctly.

### `2)` Replace direct README files with symlinks

> Convert every direct skill README landing page into the plugin README symlink convention.

1. For every direct regular file at `plugins/<plugin>/skills/<skill>/README.md`, remove the file and create a symlink named `README.md` targeting `../../README.md`.
2. Do not touch deeper README files under `assets/`, `references/`, templates, or generated-project templates.
3. Ensure Git records the symlink mode change rather than a copied README file.

### `3)` Refresh generated catalogs if required

> Bring catalog output into sync with the converted tree.

1. Run the plugin catalog generation command used by `lefthook`.
2. Review catalog diffs for expected changes only.
3. If catalogs still list direct skill README entries as ordinary files, leave that for Phase 3 validation/catalog handling.

## Acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | The direct target list includes only paths exactly shaped as `plugins/<plugin>/skills/<skill>/README.md`; nested asset/template READMEs are excluded. |
| 2 | Each direct skill `README.md` is a symlink whose `readlink` target is `../../README.md`, and `realpath` resolves to the owning plugin README. |
| 2 | `git status --short` shows mode/content changes for direct skill README paths only, with no accidental deletion of nested asset README files. |
| 3 | Regenerated catalogs are either unchanged or changed only in ways explained by symlink handling. |

## Validation commands

```sh
find plugins -mindepth 4 -maxdepth 4 -path 'plugins/*/skills/*/README.md' -print | sort
find plugins -mindepth 5 -path 'plugins/*/skills/*/README.md' -print | sort
while IFS= read -r f; do plugin=${f#plugins/}; plugin=${plugin%%/*}; expected="$(pwd -P)/plugins/$plugin/README.md"; test -L "$f" || { echo "not symlink: $f"; exit 1; }; target="$(readlink "$f")"; test "$target" = "../../README.md" || { echo "bad target: $f -> $target"; exit 1; }; actual="$(cd "$(dirname "$f")/$(dirname "$target")" && pwd -P)/$(basename "$target")"; test "$actual" = "$expected" || { echo "bad resolution: $f -> $actual, expected $expected"; exit 1; }; done < <(find plugins -mindepth 4 -maxdepth 4 -path 'plugins/*/skills/*/README.md' -print | sort)
find plugins -mindepth 5 -path 'plugins/*/skills/*/README.md' -type f -print | sort
for plugin in plugins/*/; do name=$(basename "$plugin"); node scripts/summarize-markdown.js "$plugin" "${plugin}CATALOG.md" --depth=4 --fields=description,argument-hint --title="$name catalog" --tagline="Auto-generated index of skills, agents, references and assets shipped by the \`$name\` plugin." >/dev/null; done
```

## Dependencies

- None.

## Expected commit boundary

Commit after every direct per-skill README has been converted to a symlink and any immediately required catalog refresh is complete.
