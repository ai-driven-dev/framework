# Phase 12 — Build-dist + tests + docs (final acceptance gate)

> Reconstruct `framework/scripts/build-dist.sh` for per-tool tarball generation. Invert test pyramid (max unit, light integration, ≤6 E2E on main journeys). Update README + ARCHITECTURE + CHANGELOG. Final commit before merge.

## Pre-requisites

- Phases 1–11 landed
- All per-phase tests passing in isolation

## Goal

Three deliverables combined:

1. **Framework `build-dist.sh` reconstruction** — recreate the per-tool tarball script deleted in `27bcee6`. Produces `framework/dist/<tool>-{local,remote}/` directories ready for tarball CI uploads.
2. **Test pyramid inversion** — invert pyramid: max unit tests, light integration only at adapter boundaries, ≤6 E2E tests covering main user journeys. Target: `pnpm test` runs in <60s.
3. **Documentation alignment** — README, ARCHITECTURE.md, CHANGELOG.md updated to reflect noun-first surface, manifest v5 schema, marketplace-only architecture.

This phase is the merge gate before `feat/cli-v5-cleanup` lands on `feat/plugin-architecture`.

## Architecture compliance

### Build-dist
Build script lives outside the CLI (in framework repo) — does NOT bypass CLI's public commands. Script invokes installed `aidd` CLI binary (not source). Bash, not Node, to keep framework dependency-free. Idempotent: re-run on existing `dist/` purges and rebuilds.

### Tests
Every use-case unit-tested by direct construction with in-memory ports. Adapters tested in integration only when they have non-trivial translation logic. E2E tests invoke the built CLI binary against a temp dir — no source-level imports.

Test naming follows convention: `*.unit.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`.

### Main journeys (E2E coverage)

Six E2E tests, no more:

1. **Greenfield setup** — `aidd setup --source remote --all --recommended-plugins --yes` → manifest v5 + AI/IDE configs + plugins installed
2. **Brownfield migrate** — stage v3 manifest fixture → `aidd migrate` → manifest v5 + backup + dead files removed
3. **Plugin install from marketplace** — fresh project → `aidd marketplace add` + `aidd plugin install` → plugin files present
4. **Sync plugins inter-tool** — claude with plugin → `aidd ai sync --source claude --target cursor` → cursor receives translated plugin
5. **Update global** — `aidd update` chains AI + IDE + plugin updates
6. **Clean** — `aidd clean --force` removes `.aidd` and tracked files

Anything beyond these 6 lives in unit or integration tests.

## Steps

### A. Framework `build-dist.sh` reconstruction

Output structure:

```
framework/dist/
├── claude-local/                  ← aidd setup --source local --path $FRAMEWORK_ROOT --ai claude --ide vscode --recommended-plugins --yes
├── claude-remote/                 ← aidd setup --source remote --ai claude --ide vscode --recommended-plugins --yes
├── cursor-local/  / cursor-remote/
├── copilot-local/ / copilot-remote/
└── codex-local/   / codex-remote/
```

OpenCode deferred (next-version scope per locked decision).

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

TOOLS=(claude cursor copilot codex)
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
  - [ ] Drop `opencode` from per-tool tarball loop
  - [ ] Drop opencode-related upload lines in `Attach tarballs to release`
  - [ ] Verify `dist/$tool-local` and `dist/$tool-remote` paths match script output

### B. Test inventory + reduction

- [ ] Enumerate every existing test file (count by category):
  - `fd -t f "\.unit\.test\.ts$" tests | wc -l`
  - `fd -t f "\.integration\.test\.ts$" tests | wc -l`
  - `fd -t f "\.e2e\.test\.ts$" tests | wc -l`
- [ ] Tag each integration test as `KEEP` or `DEMOTE` (most demote to unit with in-memory ports)
- [ ] Tag each E2E test as `KEEP` (matches one of the 6 journeys) or `DELETE`/`DEMOTE`
- [ ] Document inventory in `aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-12-test-inventory.md`

### C. Convert integration → unit where possible

- [ ] For each `*.integration.test.ts` instantiating a use case:
  - [ ] Replace real adapters with in-memory port implementations
  - [ ] Move the file to `tests/.../*.unit.test.ts`
  - [ ] Verify still passes
- [ ] Keep integration only when adapter behavior is the test target (manifest deserialize, marketplace fetch, FS layout)

### D. Rewrite E2E suite

- [ ] Delete every E2E test not on the 6-journey list
- [ ] Add missing journeys (probably 1 or 2 not currently covered)
- [ ] Each E2E uses `tmp.dirSync()`, invokes built CLI via `execa`, asserts on disk + exit code
- [ ] No E2E uses `aidd-context` plugin's init skill (memory stub manual — not part of CLI E2E scope)

### E. In-memory port helpers

- [ ] Ensure `tests/helpers/ports/` contains in-memory implementations for every port:
  - `FileSystem` (in-memory map)
  - `Logger` (capture)
  - `Prompter` (scripted answers)
  - `Hasher` (deterministic stub)
  - `Platform` (fake)
  - `PluginFetcher` (fixture-backed)
  - `MarketplaceRegistry` (in-memory)
  - `MarketplaceCachePort` (in-memory)
  - `AuthReader` (fake)
  - `CurrentVersionProvider` (constant)
- [ ] Helpers exported from `tests/helpers/index.ts` (allowed exception to no-barrel rule for tests)

### F. Test speed budget

- [ ] Run `pnpm test` and measure
- [ ] If >60s, profile: identify slow tests, demote or speed up
- [ ] CI step: fail if `pnpm test` >90s (hard ceiling, soft target 60s)

### G. Documentation alignment

- [ ] Update `README.md`:
  - [ ] Drop legacy command references (cache, config, install --path)
  - [ ] Update install snippet to noun-first surface (`aidd ai install <tool>`)
  - [ ] Document `aidd setup` interactive + scriptable flows
  - [ ] Document migration via `aidd migrate`
- [ ] Update `ARCHITECTURE.md`:
  - [ ] Update layer diagram (no FrameworkResolver, no FrameworkCache)
  - [ ] Update use-case list (mark new orchestrators)
  - [ ] Document `SetupFlow` aggregate, `MarketplaceSourceMode` value object, `MigrationPlan`, `MarketplaceEntry`, `MarketplaceCacheEntry`
  - [ ] Document plugin re-translation pipeline
- [ ] Update `CHANGELOG.md`:
  - [ ] Section "Breaking changes" listing every flag/command removed
  - [ ] Section "New surface" listing noun-first commands
  - [ ] Section "Migration guide" with command mapping table (old → new)
- [ ] Bump `package.json` version to `4.1.0-beta.11` (or next available beta) once all phases land

### H. Final acceptance run

- [ ] `pnpm clean && pnpm install && pnpm build && pnpm test && pnpm typecheck && pnpm biome check`
- [ ] Run all 6 E2E journeys manually via the built binary
- [ ] Review final commit log: 12 commits on `feat/cli-v5-cleanup` matching phase numbers (Phases 0–11 plus this one)

## Acceptance criteria

- [ ] `bash framework/scripts/build-dist.sh` runs locally, produces 8 dirs (4 tools × 2 modes)
- [ ] Each produced manifest is valid v5
- [ ] Local-mode marketplaces in `.claude/settings.json` use relative `./` path (portable)
- [ ] Remote-mode marketplaces reference public git URL
- [ ] `framework/.github/workflows/ci.yml` updated and passes on tag push
- [ ] Per-tool tarballs attached to GitHub release
- [ ] `pnpm test` runs in <60s
- [ ] Unit:integration:e2e ratio ≥10:3:1 (count files)
- [ ] Exactly 6 E2E test files, mapped to 6 journeys
- [ ] All in-memory port helpers present in `tests/helpers/ports/`
- [ ] README, ARCHITECTURE, CHANGELOG fully updated
- [ ] Final `pnpm test`, `pnpm typecheck`, `pnpm biome check`, `pnpm build` all green
- [ ] `git log feat/plugin-architecture..feat/cli-v5-cleanup` shows ≥12 commits, one per phase, conventional commit format

## Manual validation

```bash
cd /Users/baptistelafourcade/Projects/freelance/aidd/aidd/cli
pnpm clean && pnpm install
time pnpm test            # <60s
pnpm typecheck            # clean
pnpm biome check          # clean
pnpm build                # clean

# Pyramid check
fd -t f "\.unit\.test\.ts$" tests | wc -l       # large
fd -t f "\.integration\.test\.ts$" tests | wc -l  # moderate
fd -t f "\.e2e\.test\.ts$" tests | wc -l        # exactly 6

# Each E2E journey
pnpm test tests/e2e/greenfield-setup.e2e.test.ts
pnpm test tests/e2e/brownfield-migrate.e2e.test.ts
pnpm test tests/e2e/plugin-install.e2e.test.ts
pnpm test tests/e2e/sync-plugins.e2e.test.ts
pnpm test tests/e2e/update-global.e2e.test.ts
pnpm test tests/e2e/clean.e2e.test.ts

# Build-dist (framework repo)
cd ../framework
bash scripts/build-dist.sh
ls dist/    # claude-local claude-remote cursor-local cursor-remote copilot-local copilot-remote codex-local codex-remote
cat dist/claude-local/.aidd/manifest.json | jq .version    # 5
cat dist/claude-local/.claude/settings.json | jq '.marketplaces[].source.path'   # "./"
```

## Risks / breaking changes

- Demoting integration tests to unit risks losing real-FS coverage — mitigate with thin "smoke" integration suite hitting actual FS once per major adapter.
- E2E journey list opinionated — if a regression slips through, add unit test, not E2E.
- Documentation drift: docs reviewed per-phase, not lumped at end. This phase catches the residue.
- Build-dist script depends on `aidd` CLI on PATH in CI — `framework/.github/workflows/ci.yml` already does `npm install -g @ai-driven-dev/cli@latest` before script.
- Pre-Phase-3 manifests in dist (cached) get incompatible — CI must purge `dist/` between runs (script does `rm -rf` at iteration start).

## Final merge

After all 12 phases land on `feat/cli-v5-cleanup`:

```bash
git checkout feat/plugin-architecture
git merge --no-ff feat/cli-v5-cleanup
git log --oneline feat/plugin-architecture | head -15
# expect: 12 cleanup commits + earlier history
```

No squash. Each phase = meaningful checkpoint.

## Commit

```
test,docs(cli): invert test pyramid + reconstruct build-dist + align docs

Reduce integration tests to adapter-boundary coverage only.
Demote use-case integration tests to unit with in-memory ports.
Trim E2E to 6 main journeys (greenfield, brownfield, plugin install,
sync plugins, update global, clean).

Add in-memory port helpers under tests/helpers/ports/ for every domain port.

Reconstruct framework/scripts/build-dist.sh deleted in 27bcee6:
- Loops claude/cursor/copilot/codex × local/remote (opencode deferred)
- Uses noun-first aidd setup --source local|remote
- Rewrites local-mode marketplace paths to relative ./ for portable tarballs
Update framework/.github/workflows/ci.yml to drop opencode tarballs.

Update README, ARCHITECTURE, CHANGELOG to reflect:
- Noun-first surface (ai/ide/plugin/marketplace)
- Setup orchestrator (interactive + scriptable)
- Manifest v5 schema (no docsDir/repo/mode/scripts/topPlugins)
- Memory ownership shifted to plugins
- Marketplace cache subcommand
- Inter-tool plugin sync semantics

Final acceptance gate before merging feat/cli-v5-cleanup back to feat/plugin-architecture.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-12.md
```
