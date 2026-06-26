---
status: done
---

# Instruction: Validate Catalogs, Distribution, And Checks

Part of [`plan.md`](./plan.md).

## Architecture projection

```txt
scripts/
  summarize-markdown.js        # may need symlink-aware catalog behavior
  validate-*.mjs
.github/workflows/
  validate.yml                 # runs lefthook over all files
plugins/
  <plugin>/
    CATALOG.md                 # generated, deterministic
    README.md
    skills/<skill>/README.md -> SKILL.md
```

## Tasks to do

### `1)` Make cataloging symlink-aware where needed

> Ensure generated catalogs and docs do not misrepresent symlinked skill READMEs as unique source files.

1. Run catalog generation for every plugin and inspect how direct skill README symlinks appear.
2. If catalog rows are misleading or duplicate `SKILL.md` metadata through the symlink, update `scripts/summarize-markdown.js` to handle symlinked direct skill READMEs deliberately.
3. Preserve catalog coverage for nested asset/template README files, because those remain substantive files.

### `2)` Confirm generator seeding is the durable guardrail

> Ensure new plugin-source skills seed the README symlink at creation instead of relying on a repository-wide validator.

1. Keep `lefthook.yml` free of a dedicated skill README symlink validator.
2. Confirm `04-skill-generate` seeds `README.md -> SKILL.md` in plugin-source creation mode.
3. Confirm modify mode preserves a correct symlink and does not touch nested asset/template README files.

### `3)` Validate repository and build-relevant surfaces

> Prove the change works with the repository's available checks and release packaging assumptions.

1. Run the same local check path CI uses.
2. Run a one-off symlink assertion across all direct skill README paths for this migration.
3. If practical in the environment, smoke-test the framework build command used by release packaging for at least one target; otherwise record why it was skipped.
4. Review `git diff --stat` and `git diff --check`.

## Acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `plugins/*/CATALOG.md` files are deterministic after regeneration and do not depend on stale per-skill README contents. |
| 1 | Nested asset/template README entries still appear when catalog rules include them. |
| 2 | `04-skill-generate` creation guidance seeds `README.md -> SKILL.md` at creation time. |
| 2 | No dedicated repository validator script or lefthook command is committed for this convention. |
| 3 | `pnpm exec lefthook run pre-commit --all-files --force` passes. |
| 3 | One-off symlink assertion passes for every direct skill README in this migration. |
| 3 | `git diff --check` passes, and any skipped build smoke test is justified in the implementation notes. |

## Validation commands

```sh
pnpm exec lefthook run pre-commit --all-files --force
while IFS= read -r f; do expected="$(cd "$(dirname "$f")" && pwd -P)/SKILL.md"; test -L "$f" || { echo "not symlink: $f"; exit 1; }; target="$(readlink "$f")"; test "$target" = "SKILL.md" || { echo "bad target: $f -> $target"; exit 1; }; actual="$(cd "$(dirname "$f")" && realpath "$target")"; test "$actual" = "$expected" || { echo "bad resolution: $f -> $actual, expected $expected"; exit 1; }; done < <(find plugins -mindepth 4 -maxdepth 4 -path 'plugins/*/skills/*/README.md' -print | sort)
find plugins -mindepth 4 -maxdepth 4 -path 'plugins/*/skills/*/README.md' -type f -print | grep . && { echo "regular direct skill README remains"; exit 1; } || true
find plugins -mindepth 5 -path 'plugins/*/skills/*/README.md' -type f -print | sort
git diff --check
git diff --stat
npx --yes @ai-driven-dev/cli@4.6.1 framework build --source . --target codex --out "$(mktemp -d)" --flat
```

## Dependencies

- Phase 1 must provide the symlinked tree.
- Phase 2 must update generation/docs assumptions before final validation.

## Expected commit boundary

Commit after validation/catalog handling is complete and all checks have been run or explicitly documented as skipped.
