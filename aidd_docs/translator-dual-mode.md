# Translator Dual-Mode Architecture

> **Audience:** contributors adding a new AI tool or modifying the plugin install flow.
> **Scope:** the routing contract between a `PluginsCapability` declaration and the adapter that materializes the plugin.

---

## Why two modes

AI tools fall into two families:

- **Native marketplace support** (Claude Code, Copilot, Codex, Cursor) — the tool reads a config file that lists registered marketplaces and enabled plugins. The CLI registers the framework as a marketplace entry; the tool itself handles the fetch/install.
- **No native marketplace** (OpenCode) — the tool only sees files on disk under its config directory. The CLI must materialize plugin content as concrete files.

A third axis exists for tools with native marketplace support that **do not read project-local marketplace configs** (Cursor). For those, the CLI falls back to file materialization at the user-scope plugins directory.

---

## Three routing dimensions

The `PluginsCapability` exposes three orthogonal fields that together select the adapter:

| Field             | Values                          | Controls                                                    |
| ----------------- | ------------------------------- | ----------------------------------------------------------- |
| `mode`            | `native` \| `flat` \| `unsupported` | File layout shape (under `pluginsDir` vs flat under section) |
| `translationMode` | `marketplace` \| `flat` \| `null`   | Which adapter handles `addPlugin`                            |
| `installScope`    | `project` \| `user`                 | Base directory for file materialization                      |

These can combine independently. The two adapters together cover four practical combinations:

| `mode`   | `translationMode` | `installScope` | Adapter                              | Used by  |
| -------- | ----------------- | -------------- | ------------------------------------ | -------- |
| `native` | `marketplace`     | `project`      | `ModeAMarketplaceAdapter`            | Claude, Copilot, Codex |
| `native` | `flat`            | `user`         | `ModeBFlatMaterializationAdapter`    | Cursor   |
| `flat`   | `flat`            | `project`      | `ModeBFlatMaterializationAdapter`    | OpenCode |
| `unsupported` | `null`       | `project`      | none (no plugin install)             | —        |

---

## Routing priority

`resolveTranslationAdapter` in `src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.ts`:

1. `installScope === "user"` → `ModeBFlatMaterializationAdapter`
2. `translationMode === "marketplace"` → `ModeAMarketplaceAdapter`
3. `translationMode === "flat"` → `ModeBFlatMaterializationAdapter`
4. otherwise → `null`

Note: `installScope === "user"` wins over `translationMode === "marketplace"` because user-scope tools (Cursor) cannot rely on project-local marketplace registration.

---

## Mode A — Marketplace registration

`ModeAMarketplaceAdapter` (`src/application/use-cases/plugin/translator/mode-a-marketplace-adapter.ts`).

**What it does:**
- Adds a `Plugin` entry to the `Manifest` with an empty `files` map.
- Does **not** write any plugin file on disk.
- The `MarketplaceSyncSettingsUseCase` later writes `extraKnownMarketplaces` + `enabledPlugins` into the tool's config file using the `MarketplaceSettings` declared in the capability.

**File outputs (after sync):**
- Claude → `.claude/settings.json`
- Copilot → `.github/copilot/settings.json`
- Codex → `.codex/config.json` *(audit-trail mirror; Codex itself reads `~/.codex/config.toml`)*

**Required capability fields:**
- `mode: "native"`
- `pluginsDir: string` (where the tool expects plugins, used by sync if needed)
- `pluginManifestRelativePath`
- `translationMode: "marketplace"`
- `marketplaceSettings: { settingsPath, settingsKey, enabledPluginsKey?, toEntry }`

---

## Mode B — Flat materialization

`ModeBFlatMaterializationAdapter` (`src/application/use-cases/plugin/translator/mode-b-flat-materialization-adapter.ts`).

**What it does:**
- Calls `PluginTranslator.translateWithComponentPaths` to compute the on-disk file shape.
- Writes every produced file under `resolvePluginsBaseDir(projectRoot, homedir)`.
- Registers the plugin in the manifest with the files map keyed by base-relative path.

**Two layout sub-shapes** depending on `PluginsCapability.mode`:

- `mode: "native"` (Cursor) → `PluginTranslator.translateNativeWithPaths` produces `<pluginName>/<component>/<file>`. With `pluginsDir: ""` and `installScope: "user"`, files land at `~/.cursor/plugins/local/<pluginName>/<component>/<file>`.
- `mode: "flat"` (OpenCode) → `PluginTranslator.translateFlat` produces `<directory><section>/<pluginName>/<file>` (e.g. `.opencode/commands/<pluginName>/<file>`).

**Required capability fields (native + user-scope variant):**
- `mode: "native"`
- `pluginsDir: ""` (no sub-prefix — the plugin name is the root)
- `translationMode: "flat"`
- `installScope: "user"`
- `userPluginsDir: (homedir) => string` (e.g. `(h) => join(h, ".cursor", "plugins", "local")`)

**Required capability fields (flat + project-scope variant):**
- `mode: "flat"`
- `flatNamespacePrefix: string` (collision-prevention prefix applied to command/agent names)

---

## How to add a new tool

1. **Decide the routing combination** from the table above. Pick `mode`, `translationMode`, `installScope` to match the tool's actual behavior — verify against the tool's documentation, not assumptions.

2. **Declare the tool** under `src/domain/tools/ai/<tool>.ts`. Compose the existing capability classes (`AgentsCapability`, `CommandsCapability`, `RulesCapability`, etc.) plus the `PluginsCapability` configured per the table above.

3. **Add the toolId** to `src/domain/models/tool-ids.ts` (`AiToolId` union and `AI_TOOL_IDS` array).

4. **Register at module load** via `registerTool(<tool>)` at the bottom of the tool file.

5. **Add integration test** under `tests/application/use-cases/plugin/translator/` following the existing per-tool file naming: `install-plugin-<tool>-mode-<a|b>.integration.test.ts`. Assert the observable output:
   - Mode A → settings file content after `MarketplaceSyncSettingsUseCase.execute`.
   - Mode B → file paths written via `ModeBFlatMaterializationAdapter.addPlugin`.

6. **Update this doc** — add the tool to the routing matrix above. Without that, future contributors will lose the cross-reference.

---

## Scope matrix and `--scope` flag

`aidd plugin install --scope user|project` validates the requested scope against the tool's capability before any install work. Same flag exists on `aidd marketplace add` (replaces the old `--user` boolean).

| Tool     | Supported scope | `--scope user`     | `--scope project`  |
| -------- | --------------- | ------------------ | ------------------ |
| Claude   | `project`       | rejected           | accepted (default) |
| Copilot  | `project`       | rejected           | accepted (default) |
| Codex    | `project`       | rejected           | accepted (default) |
| OpenCode | `project`       | rejected           | accepted (default) |
| Cursor   | `user`          | accepted (default) | rejected           |

Mismatch raises `InvalidPluginScopeError` with a clear message including the supported scope. Default scope is read from the tool's `PluginsCapability.installScope` — Cursor is the only tool that currently uses `"user"`.

---

## Reference files

- `src/domain/capabilities/plugins-capability.ts` — capability surface, validation rules.
- `src/domain/models/plugin-translation-mode.ts` — `PluginTranslationMode` discriminant type.
- `src/domain/models/plugin-translator.ts` — `translateNativeWithPaths` and `translateFlat`.
- `src/application/use-cases/plugin/translator/plugin-translation-adapter-factory.ts` — routing entry point.
- `src/application/use-cases/marketplace/marketplace-sync-settings-use-case.ts` — Mode A settings writer.

---

← [Back to CONTRIBUTING.md](../CONTRIBUTING.md)
