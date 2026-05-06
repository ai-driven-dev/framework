# Phase 10 — Framework `build-dist.sh` reconstruction

> Recreate the framework's per-tool tarball generation script using the new CLI surface. Wire it into the framework's CI release workflow.

## Pre-requisites

- Phase 3 (setup orchestrator scriptable) landed
- Phase 5 (noun-first surface) landed — `aidd ai install`, `aidd ide install`

## Goal

`framework/scripts/build-dist.sh` was deleted in commit `27bcee6` ("strip obsolete config/, aidd_docs/, and build-dist.sh"). Its purpose: produce per-tool ready-to-tarball directories so users can grab a zip and bootstrap without running `aidd` themselves.

The framework's CI workflow (`framework/.github/workflows/ci.yml`) still references the output of this script (per-tool tarball uploads to release). Since `27bcee6`, releases are broken on this front.

## Output structure (rebuilt)

```
framework/dist/
├── claude-local/                  ← aidd setup --source local --path $FRAMEWORK_ROOT --ai claude --ide vscode --recommended-plugins --yes
│   ├── .aidd/manifest.json
│   ├── .claude/...
│   ├── .vscode/...
│   └── (plugin files)
├── claude-remote/                 ← aidd setup --source remote --ai claude --ide vscode --recommended-plugins --yes
│   ├── ...
├── cursor-local/
├── cursor-remote/
├── copilot-local/
├── copilot-remote/
├── codex-local/
└── codex-remote/
```

OpenCode deferred (per locked decision — next-version scope).

## Architecture compliance

- Build script lives outside the CLI (in framework repo) — does NOT bypass CLI's public commands
- Script invokes installed `aidd` CLI binary (not source — script runs in CI after `npm install -g @ai-driven-dev/cli@latest`)
- Script is bash, not Node, to keep framework repo dependency-free
- Idempotent: re-run on existing `dist/` purges and rebuilds

## Steps

- [ ] Create `framework/scripts/build-dist.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

FRAMEWORK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v aidd >/dev/null; then
  echo "Error: aidd CLI not found in PATH. Install with: npm install -g @ai-driven-dev/cli@latest" >&2
  exit 1
fi

aidd --version

TOOLS=(claude cursor copilot codex)   # opencode deferred
MODES=(local remote)

for tool in "${TOOLS[@]}"; do
  for mode in "${MODES[@]}"; do
    target="$FRAMEWORK_ROOT/dist/$tool-$mode"
    rm -rf "$target"
    mkdir -p "$target"
    pushd "$target" >/dev/null

    if [ "$mode" = "local" ]; then
      aidd setup \
        --source local \
        --path "$FRAMEWORK_ROOT" \
        --ai "$tool" \
        --ide vscode \
        --recommended-plugins \
        --yes
    else
      aidd setup \
        --source remote \
        --ai "$tool" \
        --ide vscode \
        --recommended-plugins \
        --yes
    fi

    # Strip CI-absolute marketplace paths so tarballs are portable
    if [ "$mode" = "local" ]; then
      node -e "
        const fs = require('fs');
        const path = require('path');
        const root = process.cwd();
        const settings = path.join(root, '.claude', 'settings.json');
        if (fs.existsSync(settings)) {
          const data = JSON.parse(fs.readFileSync(settings, 'utf8'));
          if (data.marketplaces) {
            for (const mp of Object.values(data.marketplaces)) {
              if (mp.source && mp.source.kind === 'local') mp.source.path = './';
            }
          }
          fs.writeFileSync(settings, JSON.stringify(data, null, 2));
        }
      "
    fi

    popd >/dev/null
    echo "Built $target"
  done
done
```

- [ ] Make executable: `chmod +x framework/scripts/build-dist.sh`
- [ ] Update `framework/.github/workflows/ci.yml`:
  - [ ] Step `Build distributions` already runs `bash scripts/build-dist.sh` — verify still aligned
  - [ ] Step `Build per-tool tarballs` already loops `for tool in claude cursor copilot opencode codex` — drop `opencode` (deferred)
  - [ ] Step `Attach tarballs to release` — drop opencode lines
  - [ ] Verify `dist/$tool-local` and `dist/$tool-remote` paths match script output
- [ ] Optionally: add a CI smoke test step running `aidd setup --help` first to fail fast if CLI binary mismatched

## Tests

### Smoke test (CI)

- [ ] After `bash scripts/build-dist.sh` in CI, verify each `dist/<tool>-<mode>/.aidd/manifest.json` exists and parses to v5 schema
- [ ] Verify each `dist/<tool>-<mode>/` is non-empty
- [ ] No `opencode` directory produced (deferred)

### No unit/integration tests in CLI repo

- Script lives in framework repo — covered by framework CI

## Acceptance criteria

- [ ] `bash framework/scripts/build-dist.sh` runs locally, produces 8 dirs (4 tools × 2 modes)
- [ ] Each produced manifest is valid v5
- [ ] Local-mode marketplaces in `.claude/settings.json` use relative `./` path (portable)
- [ ] Remote-mode marketplaces reference the public git URL
- [ ] CI workflow updated and passes on a tag push
- [ ] Per-tool tarballs attached to GitHub release

## Manual validation

```bash
cd /Users/baptistelafourcade/Projects/freelance/aidd/aidd/framework
bash scripts/build-dist.sh
ls dist/
# expect: claude-local claude-remote cursor-local cursor-remote copilot-local copilot-remote codex-local codex-remote

cat dist/claude-local/.aidd/manifest.json | jq .version    # expect 5
cat dist/claude-local/.claude/settings.json | jq '.marketplaces[].source.path'    # expect "./" (portable)
```

## Risks / breaking changes

- Script depends on `aidd` CLI being on PATH in CI — `framework/.github/workflows/ci.yml` already does `npm install -g @ai-driven-dev/cli@latest` before running script
- `--recommended-plugins` flag must exist in CLI (Phase 3 confirms) — otherwise script fails
- Local-mode tarballs depend on relative path rewrite in `.claude/settings.json` — if marketplace settings format changes, rewrite logic must follow
- Pre-Phase-3 manifests in dist (if any cached) get incompatible — CI must purge `dist/` between runs (script does `rm -rf` at start of each iteration)

## Commit

```
feat(framework): rebuild build-dist.sh for v5 CLI surface

Recreate per-tool/per-mode dist generation deleted in 27bcee6:
- Loops claude/cursor/copilot/codex × local/remote (opencode deferred)
- Uses noun-first aidd setup --source local|remote --ai <t> --ide vscode --recommended-plugins --yes
- Rewrites local-mode marketplace paths to relative ./ for portable tarballs

Update CI workflow to drop opencode tarballs (deferred to next-version scope).

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-10.md
```

> Note: this commit lives on the **framework** repo, not the CLI repo. It can be committed separately on a parallel branch in `framework/` and merged independently. The CLI's `feat/cli-v5-cleanup` branch contains only the planning doc, not the framework script itself.
