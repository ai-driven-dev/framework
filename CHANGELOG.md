# Changelog

## [4.1.0-beta.1] — Marketplace-only architecture

### ⚠ BREAKING CHANGES

* **install**: `aidd install ai <tool>` and `aidd install ide <tool>` now write bundled runtime configs from the CLI binary instead of downloading a framework tarball. The `--release`, `--path`, `--repo`, `--from`, and `--mode` flags are removed from `install` and `setup`.
* **setup**: `aidd setup` no longer downloads a framework tarball. It initializes the manifest, registers the default marketplace, and writes bundled configs. `--switch-mode` and `--mode` flags removed.
* **framework**: Framework is now a pure plugin marketplace (Git repo with `marketplace.json` + `plugins/`). The CLI no longer fetches or caches framework tarballs. `aidd cache` command removed.
* **config**: `repo` config key removed. Use `aidd marketplace` to manage marketplace sources.

### Features

* **migrate**: new `aidd migrate` command — detects and strips obsolete manifest entries (scripts section, top-level plugins section, bundled plugins) from projects on previous CLI versions. Backs up manifest before write. `--dry-run` and `--non-interactive` flags.
* **assets**: runtime configs (Claude, Cursor, Copilot, OpenCode, Codex) and memory stubs (CLAUDE.md, AGENTS.md, copilot-instructions.md) bundled inside the CLI binary — no network required for `aidd install ai`.
* **plugin install**: prompts for target tools when multiple AI tools installed; `--tool` flag for non-interactive use.
* **marketplace**: default marketplace (`github.com/ai-driven-dev/aidd-framework`) pre-registered on `aidd setup`. No auth required for public marketplace.

### Migration

Run `aidd migrate` to clean up any project initialized with CLI < 4.1.0.

## [4.0.0](https://github.com/ai-driven-dev/aidd-cli/compare/v3.3.1...v4.0.0) (2026-04-23)


### ⚠ BREAKING CHANGES

* **cli:** `aidd install <toolId>` and `aidd uninstall <toolId>` without a category prefix are no longer valid. Use `aidd install ai <toolId>` or `aidd install ide <toolId>` instead.
* **cli:** `aidd install <toolId>` and `aidd uninstall <toolId>` without a category prefix are no longer valid. Use `aidd install ai <toolId>` or `aidd install ide <toolId>` instead.

### Features

* **cli:** enforce category prefix for install and uninstall commands ([ae34aec](https://github.com/ai-driven-dev/aidd-cli/commit/ae34aece30aa3c0d9f32f9110221cb8589d8d25f))
* **cli:** enforce category prefix for install and uninstall commands ([cc781e3](https://github.com/ai-driven-dev/aidd-cli/commit/cc781e312bf13ceca8d55c3e27c2ee8fc705d725))
* **setup:** ai/ide category filter + replace --tools with --ai/--ide/--all ([e2280b2](https://github.com/ai-driven-dev/aidd-cli/commit/e2280b2167dc7cec32d515fbebcdae3e74982122))


### Bug Fixes

* **auth:** move AuthContext out of domain port into infrastructure ([75cc175](https://github.com/ai-driven-dev/aidd-cli/commit/75cc175d742ebba71eb12a5fbd7e16a9ef4f4bb6))
* **auth:** replace httpGet function injection with typed LoginVerifier ports ([e0bf067](https://github.com/ai-driven-dev/aidd-cli/commit/e0bf0672348f02b37aa75878452d2845c9402717))
* **install:** aggregate MCP keys and prompt once across all tools ([ff09210](https://github.com/ai-driven-dev/aidd-cli/commit/ff09210df092d4d27350913055e532f02ea20a77)), closes [#142](https://github.com/ai-driven-dev/aidd-cli/issues/142)
* **install:** clarify missing IDE warning with specific feature list ([6e16517](https://github.com/ai-driven-dev/aidd-cli/commit/6e165172e41481b90e5cab88bd9d42cc8be7ebb6))
* **install:** require ai|ide category prefix, improve command help ([ee88851](https://github.com/ai-driven-dev/aidd-cli/commit/ee8885177533e92cbcd4d515c5efffa79141b6c8))
* **install:** skip IDE-rooted files when required IDE is not installed ([fa445dc](https://github.com/ai-driven-dev/aidd-cli/commit/fa445dc65c7e2b0df0735758e5d2af294df2df1c)), closes [#143](https://github.com/ai-driven-dev/aidd-cli/issues/143)
* **mcp:** prompt once per install/update across all tools ([e475621](https://github.com/ai-driven-dev/aidd-cli/commit/e47562126650ab6859b86742e2723a7d96a9fb42))
* **uninstall:** strip entries from keyed-section merge files instead of deleting ([4b2222b](https://github.com/ai-driven-dev/aidd-cli/commit/4b2222b57bfcfe2c1226b616283fc20037678aae))
* **update:** aggregate MCP entries and prompt once across all tools ([1bd816c](https://github.com/ai-driven-dev/aidd-cli/commit/1bd816c310c314465212ebfaddf639da70dd9e75)), closes [#142](https://github.com/ai-driven-dev/aidd-cli/issues/142)


### Documentation

* **tasks:** add auth refactor plan and code review ([e57c527](https://github.com/ai-driven-dev/aidd-cli/commit/e57c5275fb47fcacd9cb2360f22203e8cdce2fbb))
* **tasks:** add mcp single-prompt plans and code review ([652ae71](https://github.com/ai-driven-dev/aidd-cli/commit/652ae714a4d08f7a8603c60a4f36cf40b83df308))


### Refactoring

* **auth:** introduce AuthCredential union and move credential resolution to command ([3c97d37](https://github.com/ai-driven-dev/aidd-cli/commit/3c97d378b8ba2944158ac5d8e1b40e050c214f48))
* **auth:** pure use-case via resolveContext port method ([d04a3c3](https://github.com/ai-driven-dev/aidd-cli/commit/d04a3c365548e9e03332f5b667b21b31ec3574ed))
* **auth:** use-cases receive one LoginVerifier, method resolved at command level ([76d81cf](https://github.com/ai-driven-dev/aidd-cli/commit/76d81cfb8f979410cb735913e0095704d07e6d94))
* **domain:** extract AIDD_DIR to shared paths constant ([a8a4dde](https://github.com/ai-driven-dev/aidd-cli/commit/a8a4ddece39220b0e5868b02a2375c0132af5db3))
* **mcp:** centralize prompt logic in shared McpUseCase ([90993e9](https://github.com/ai-driven-dev/aidd-cli/commit/90993e94063bea628d7cbb94d9cc5788dd683b93)), closes [#142](https://github.com/ai-driven-dev/aidd-cli/issues/142)
* **uninstall:** extract isMergeContentEmpty to domain and split removeMergeFile ([1c82cd6](https://github.com/ai-driven-dev/aidd-cli/commit/1c82cd6badb1b0bae9c47630ad7f40c9caf11fb8))
* **uninstall:** format code for better readability ([e2352e1](https://github.com/ai-driven-dev/aidd-cli/commit/e2352e106d25c1db2a2fb2c93112d16c59fd74d9))

## [3.3.1](https://github.com/ai-driven-dev/aidd-cli/compare/v3.3.0...v3.3.1) (2026-04-21)


### Bug Fixes

* **setup:** handle post-uninstall state when aidd_docs/ exists without manifest ([490649c](https://github.com/ai-driven-dev/aidd-cli/commit/490649c21f9c27bdcf0f2b21d4cba8eac93e825b))
* **setup:** handle post-uninstall state where aidd_docs/ exists without manifest ([bb6c0f7](https://github.com/ai-driven-dev/aidd-cli/commit/bb6c0f70e4dbf3eba46b13a2302fa4ba961cc3af)), closes [#141](https://github.com/ai-driven-dev/aidd-cli/issues/141)

## [3.3.0](https://github.com/ai-driven-dev/aidd-cli/compare/v3.2.0...v3.3.0) (2026-04-14)


### Features

* **mcp:** disable MCP servers by default ([6023436](https://github.com/ai-driven-dev/aidd-cli/commit/602343681b379f920634a0cc962eee7bdb397c1e))
* **mcp:** disable MCP servers by default, require explicit opt-in ([370f196](https://github.com/ai-driven-dev/aidd-cli/commit/370f196641d85474b3ae71efcc98875a7b687619))

## [3.2.0](https://github.com/ai-driven-dev/aidd-cli/compare/v3.1.4...v3.2.0) (2026-04-14)


### Features

* **domain:** granular MCP server selection during install/uninstall ([#259](https://github.com/ai-driven-dev/aidd-cli/issues/259)) ([d544c32](https://github.com/ai-driven-dev/aidd-cli/commit/d544c324f72a1fb693fc6ad0521309e5754ec4bc))
* **domain:** per-entry hash tracking for merge config files ([#131](https://github.com/ai-driven-dev/aidd-cli/issues/131)) ([61617bb](https://github.com/ai-driven-dev/aidd-cli/commit/61617bbbe606f8d4a3dc86109856fdeee963c673))
* granular MCP server selection during install/uninstall ([f172f6b](https://github.com/ai-driven-dev/aidd-cli/commit/f172f6b4bc2834d50926c71f94953bc5561b9739))


### Documentation

* **decisions:** add DEC-022, DEC-023 for MCP exclusion tracking ([df3cc8e](https://github.com/ai-driven-dev/aidd-cli/commit/df3cc8e3d7939c0fb8b8b79b4e6718d7a204c4ae))
* **errors:** update architecture rules, decisions, and memory ([904922f](https://github.com/ai-driven-dev/aidd-cli/commit/904922f32d452ed23a45590e651b2bc88b3faf0d))
* **tasks:** add code review for granular MCP selection refactor ([571feb8](https://github.com/ai-driven-dev/aidd-cli/commit/571feb82c0cf3d6ef4ad7cbaf51dcbf073a49cd6))
* **tasks:** add granular MCP selection plans and review ([aaaa433](https://github.com/ai-driven-dev/aidd-cli/commit/aaaa433457f71cf25f99846fb52616cc8009d928))


### Refactoring

* **errors:** introduce typed domain exceptions and ErrorHandler ([112416a](https://github.com/ai-driven-dev/aidd-cli/commit/112416a7d5f8318dff23186b4a8839cf70b3d70f))
* **errors:** introduce typed domain exceptions and ErrorHandler ([c726895](https://github.com/ai-driven-dev/aidd-cli/commit/c726895f2cf44da5c17f241de27596321cbe6b16)), closes [#113](https://github.com/ai-driven-dev/aidd-cli/issues/113)
* **mcp:** extract MCP selection into shared use-case and domain functions ([9156b70](https://github.com/ai-driven-dev/aidd-cli/commit/9156b700af828e8185187e9cfdbee38e5d90f786))

## [3.1.4](https://github.com/ai-driven-dev/aidd-cli/compare/v3.1.3...v3.1.4) (2026-04-07)


### Bug Fixes

* **setup:** show triggering files when adopt requires version ([e1219fe](https://github.com/ai-driven-dev/aidd-cli/commit/e1219fee6b5d88682918f7c6cd841f73bdb27fba))
* **setup:** surface adopt-trigger signals in error to help diagnose stuck state ([1b2fe39](https://github.com/ai-driven-dev/aidd-cli/commit/1b2fe394aa5038987cf08611796a5f602c604d40)), closes [#118](https://github.com/ai-driven-dev/aidd-cli/issues/118)
* **update:** preserve user MCP config customizations with merge strategy ([#125](https://github.com/ai-driven-dev/aidd-cli/issues/125)) ([fab1b41](https://github.com/ai-driven-dev/aidd-cli/commit/fab1b4182faf0ff5f1239200267e5b7c4062922b))

## [3.1.3](https://github.com/ai-driven-dev/aidd-cli/compare/v3.1.2...v3.1.3) (2026-04-06)


### Bug Fixes

* **banner:** clean up stdin listener after animation to prevent arrow key exit ([eacd585](https://github.com/ai-driven-dev/aidd-cli/commit/eacd585ae5e68fc4c7b6eae025d481b65185846c)), closes [#116](https://github.com/ai-driven-dev/aidd-cli/issues/116)
* **banner:** clean up stdin listener to prevent arrow key exit on Linux ([8acabc8](https://github.com/ai-driven-dev/aidd-cli/commit/8acabc8d7c2cfcb7713579f4ec97b6f7f4e4fa38))
* remove obsolete script files after framework renames them ([961a2fd](https://github.com/ai-driven-dev/aidd-cli/commit/961a2fdf96b4383d00a65932fa19e80d79da8d94))
* remove obsolete script files after framework renames them ([050a383](https://github.com/ai-driven-dev/aidd-cli/commit/050a3836cd73d40283423dd8dff6d16a3877c90e))
* **setup:** detect existing docs dir as adopt signal when manifest is missing ([0081ee3](https://github.com/ai-driven-dev/aidd-cli/commit/0081ee3534948c4e8a0230f7c9a62cb7b6fd9675))
* **setup:** detect existing docs dir as adopt signal when manifest is missing ([b7ab77c](https://github.com/ai-driven-dev/aidd-cli/commit/b7ab77c02e9f31e36002a608734745a6eb1bfd01)), closes [#118](https://github.com/ai-driven-dev/aidd-cli/issues/118)

## [3.1.2](https://github.com/ai-driven-dev/aidd-cli/compare/v3.1.1...v3.1.2) (2026-04-02)


### Bug Fixes

* **cursor:** normalise bare command path references during content rewrite ([de88d72](https://github.com/ai-driven-dev/aidd-cli/commit/de88d72d61313332e761b639845bc0f0f83f726e))
* **opencode:** normalise bare command path references during content rewrite ([3e3437f](https://github.com/ai-driven-dev/aidd-cli/commit/3e3437fb136fdb18cf12633121e608c249912a6a)), closes [#57](https://github.com/ai-driven-dev/aidd-cli/issues/57)
* **self-update:** add read:packages scope + typed UpdateError ([9f6bb04](https://github.com/ai-driven-dev/aidd-cli/commit/9f6bb04bb8f6d8d275e2aa0abb104e9b8e99e98e))
* **self-update:** fix package manager detection on Windows ([6c26584](https://github.com/ai-driven-dev/aidd-cli/commit/6c265844d736a526e216f0af963a99b0c659048f))
* **self-update:** fix package manager detection on Windows ([8f61eb1](https://github.com/ai-driven-dev/aidd-cli/commit/8f61eb17cfc85db105ed010266f1376480782fcd))
* **self-update:** throw typed UpdateError when package install fails ([df245b5](https://github.com/ai-driven-dev/aidd-cli/commit/df245b54c9c7e67e129ab0136e2ba2e03fea5d7f)), closes [#109](https://github.com/ai-driven-dev/aidd-cli/issues/109) [#113](https://github.com/ai-driven-dev/aidd-cli/issues/113)


### Documentation

* document read:packages scope requirement for GitHub token ([6772bbb](https://github.com/ai-driven-dev/aidd-cli/commit/6772bbb94a7448a32814ec8d90a56399794d12a4))

## [3.1.1](https://github.com/ai-driven-dev/aidd-cli/compare/v3.1.0...v3.1.1) (2026-03-30)


### Bug Fixes

* tolerate JSONC trailing commas in existing opencode.json ([7f0bfca](https://github.com/ai-driven-dev/aidd-cli/commit/7f0bfca))


### Refactoring

* application layer — methods ≤ 20 lines, shared use-cases, domain types ([5aacadc](https://github.com/ai-driven-dev/aidd-cli/commit/5aacadc))


## [3.1.0](https://github.com/ai-driven-dev/aidd-cli/compare/v3.0.0...v3.1.0) (2026-03-24)


### Features

* **setup:** add non-interactive mode support ([368520d](https://github.com/ai-driven-dev/aidd-cli/commit/368520d6e68bfafad683643840d26a6d5e34172c))
* **setup:** add non-interactive mode support ([651c034](https://github.com/ai-driven-dev/aidd-cli/commit/651c034cd3a22a8df930e98b1b69dd3b2160eaa2))


### Bug Fixes

* **setup:** disable prompts when scripting flags are provided ([3076c08](https://github.com/ai-driven-dev/aidd-cli/commit/3076c080d1e3b49679121abd613addbf9ed84491))
* **setup:** only --all-tools and --tools suppress interactive prompts ([d34d267](https://github.com/ai-driven-dev/aidd-cli/commit/d34d267fa01f995411b2ff8cbcaa1f8c2e8ca234))
* **setup:** remove --docs-dir from scripting flags detection ([5babd58](https://github.com/ai-driven-dev/aidd-cli/commit/5babd585ab540918ade15a8d0570268c7964d986))


### Documentation

* **setup:** document non-interactive flags and update project brief ([796e7d3](https://github.com/ai-driven-dev/aidd-cli/commit/796e7d32be58ddeb3a8f11e41617e42632f6a3f8))


### Refactoring

* **setup:** fix review issues — move flag guard, dedup source resolution, rename tests ([5d33588](https://github.com/ai-driven-dev/aidd-cli/commit/5d33588496062d9b45b954a31c8920746b48d3b2))

## [3.0.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.13.4...v3.0.0) (2026-03-24)


### ⚠ BREAKING CHANGES

* CLI rebuilt from scratch; prior configurations are not compatible.

### Features

* add 1.5s pause after banner to let user read it ([98ce223](https://github.com/ai-driven-dev/aidd-cli/commit/98ce2231b9147a6f7d3550a3e275abe3d6dc4444))
* add AI-Driven Dev label above logo in corner frame ([31bf641](https://github.com/ai-driven-dev/aidd-cli/commit/31bf641e4e9351347bceee2bcf1539025aa9a5f4))
* add lefthook child-to-parent delegation + auto-install ([2e7cd87](https://github.com/ai-driven-dev/aidd-cli/commit/2e7cd87165da8646538bf3d420f526f50ecaae51))
* **adopt:** add adopt command for manual installation migration ([b34bc6b](https://github.com/ai-driven-dev/aidd-cli/commit/b34bc6b5361ecdce9652a4d6f2ba28f994d24c40))
* **adopt:** resolve framework at adoption to classify framework vs user files ([88fcce3](https://github.com/ai-driven-dev/aidd-cli/commit/88fcce32b5f01f45e73b7dc4a575c178cd94cfbe))
* animated ANSI banner with glitch effect on CLI launch ([2f6f43e](https://github.com/ai-driven-dev/aidd-cli/commit/2f6f43e2c34d78b2f84275966fb0f942070da6ac))
* animated ANSI banner with glitch effect on CLI launch ([#64](https://github.com/ai-driven-dev/aidd-cli/issues/64)) ([9b62bb6](https://github.com/ai-driven-dev/aidd-cli/commit/9b62bb62b02f323da3463705fa1c9241b0797152))
* any keypress skips the entire banner animation ([3ec92cd](https://github.com/ai-driven-dev/aidd-cli/commit/3ec92cdc53a3f668174be9a18078bf55748d0692))
* **auth:** add aidd auth login/logout/status and centralize token resolution ([77188ee](https://github.com/ai-driven-dev/aidd-cli/commit/77188eeca8df776d8cf6eaf64730b92f203162ad))
* **auth:** add auth login/logout/status command and use-cases ([2a70557](https://github.com/ai-driven-dev/aidd-cli/commit/2a70557bdfce78f30517d41ee84a9f70520d2b85))
* **auth:** add AuthConfig, AuthStorage, AuthReader and GhCliAdapter ([d3d13cc](https://github.com/ai-driven-dev/aidd-cli/commit/d3d13ccafb679b2d0afeaa3f9e42c1f67fc10d09)), closes [#54](https://github.com/ai-driven-dev/aidd-cli/issues/54)
* **auth:** wire AuthReader into all commands and remove --token flag ([fd598d6](https://github.com/ai-driven-dev/aidd-cli/commit/fd598d6f0f3415f8aea5dce6e57de06308e3cee8))
* **catalog:** add catalog generation use case ([3949d88](https://github.com/ai-driven-dev/aidd-cli/commit/3949d88964a2263afded5e78373a7f9882f3a3bd))
* **cli:** add update, restore, sync, cache, config and doctor-fix commands ([095c311](https://github.com/ai-driven-dev/aidd-cli/commit/095c311eca47086619485ac9ee58cd901dfe7117))
* **cli:** rename --framework to --path and clarify framework source ([929f421](https://github.com/ai-driven-dev/aidd-cli/commit/929f4216be475b291aff94560e4de5c2e1ac460c))
* **cli:** show contextual update banner on all commands ([6f8b5da](https://github.com/ai-driven-dev/aidd-cli/commit/6f8b5da984d5796ca1f5689e62c9ec09c1f52627))
* display ASCII banner when aidd is run without arguments ([d3b7f24](https://github.com/ai-driven-dev/aidd-cli/commit/d3b7f24dfed2900ccbb5aa6cea40c32ad7962d02))
* initial migration of AIDD CLI from monorepo ([1c67878](https://github.com/ai-driven-dev/aidd-cli/commit/1c67878402e3de17673e8ce3d0c0153c95e7aaa7))
* **interactive:** add interactive menus for CLI commands ([89c91e8](https://github.com/ai-driven-dev/aidd-cli/commit/89c91e85f210e8945bd957c0fe8b25876e95060c))
* **interactive:** add interactive menus for setup, install, and update commands ([ef8de5e](https://github.com/ai-driven-dev/aidd-cli/commit/ef8de5e06b7e6f57c63a073e3b5e583e1245aab7)), closes [#13](https://github.com/ai-driven-dev/aidd-cli/issues/13)
* **m0:** migrate to 4-layer clean architecture skeleton ([2648039](https://github.com/ai-driven-dev/aidd-cli/commit/2648039c6ec51a92330d8fe81ec64444a0981cb3))
* **m1:** implement domain layer (tickets 010–016) ([25a376c](https://github.com/ai-driven-dev/aidd-cli/commit/25a376cf04e660db26da1cd08926ccc4a013d701))
* **m2:** implement infrastructure layer — HTTP, tar, cache, adapters ([ec862dc](https://github.com/ai-driven-dev/aidd-cli/commit/ec862dccbcc6a0570be0d4bd2699c71e0a1a9ee4))
* **m3:** implement init & install commands — CLI entry point, use cases, E2E tests ([5f89025](https://github.com/ai-driven-dev/aidd-cli/commit/5f89025e957ff92be3cd88b68564898beda2ba6f))
* **m4:** add clean, doctor, status, and uninstall commands and use cases ([bfd3a4f](https://github.com/ai-driven-dev/aidd-cli/commit/bfd3a4f0f47f50b825e1d5a8869da42268392a3c))
* **manifest:** add isFileTracked() to detect if a path is owned by AIDD ([1a0b5c2](https://github.com/ai-driven-dev/aidd-cli/commit/1a0b5c22d8735f833b6a58679ae42da43124b489))
* **mcp:** add platform-aware MCP config transform for win32 ([13e9c91](https://github.com/ai-driven-dev/aidd-cli/commit/13e9c919dd05ab9242d502734bb032b18a579be5)), closes [#19](https://github.com/ai-driven-dev/aidd-cli/issues/19)
* **mcp:** platform-aware MCP config transform for Windows ([bb70aa3](https://github.com/ai-driven-dev/aidd-cli/commit/bb70aa336e60987cb8ca065726451f497223f551))
* **memory:** install update_memory script and git hook on install/update ([0bdc869](https://github.com/ai-driven-dev/aidd-cli/commit/0bdc869984ecb5984f8214f20cf7eb07974d1155))
* **memory:** install update_memory script and git hook on install/update ([4b47c39](https://github.com/ai-driven-dev/aidd-cli/commit/4b47c39f51665c699b9a0a83fad9f6f3d259aed1))
* merge ascii banner from worktree ([0170bee](https://github.com/ai-driven-dev/aidd-cli/commit/0170bee3cf9ca669be83a6ae8137431706c48d5e))
* monochrome color scheme + move label below logo + add DEC-005/006 ([f77e7a7](https://github.com/ai-driven-dev/aidd-cli/commit/f77e7a793bad9064c43f5b5e097252e2722ea9ea))
* **opencode:** detect and use existing opencode.jsonc config file ([f8e4216](https://github.com/ai-driven-dev/aidd-cli/commit/f8e4216e87402def0434377715fa760ad2520bd5))
* **opencode:** detect and use existing opencode.jsonc config file ([5c58a4d](https://github.com/ai-driven-dev/aidd-cli/commit/5c58a4d62e14f2e919292cac17e552ef924a1b16))
* **opencode:** use ConfigConflictError and named handler object for config() ([b732f65](https://github.com/ai-driven-dev/aidd-cli/commit/b732f650a1732b85befc62b6cc44a7ec53d052f8))
* **pkg:** publish under @ai-driven-dev/cli ([0b082a4](https://github.com/ai-driven-dev/aidd-cli/commit/0b082a4d669a93e7dd1f3a31c8a2be4e919d8dda))
* relaunch as v2 — full architecture rewrite (M0–M5) ([5563d66](https://github.com/ai-driven-dev/aidd-cli/commit/5563d669a6c3f8cde993957f23046c28deb89fc8))
* restrict banner to no-args and --help only ([c267438](https://github.com/ai-driven-dev/aidd-cli/commit/c26743874c5c76470f77cd0e30c72cf05ac5705c))
* reveal title and info box line by line after logo animation ([10fb354](https://github.com/ai-driven-dev/aidd-cli/commit/10fb354581e0edddc9d4bb2c705a11c16983c10a))
* **rules:** add and refine coding rules across all categories ([38c6f9a](https://github.com/ai-driven-dev/aidd-cli/commit/38c6f9aec3de5e5c0c64430980dd4b543fba432a))
* show animated banner on every interactive TTY session ([9508c08](https://github.com/ai-driven-dev/aidd-cli/commit/9508c083b476294d92029b185d8597c5af899251))
* skip banner pause on any keypress ([2abd2ec](https://github.com/ai-driven-dev/aidd-cli/commit/2abd2eccaaaa059c549751caf529a51341d523ce))
* **sync:** add docs distribution and cross-tool bidirectional format conversion ([2f04dba](https://github.com/ai-driven-dev/aidd-cli/commit/2f04dba5e3c0bca4b0610aa2d5233d063c44eaba))
* **tools:** aidd-branded commands namespacing and frontmatter-based init signals ([#49](https://github.com/ai-driven-dev/aidd-cli/issues/49)) ([19ea07e](https://github.com/ai-driven-dev/aidd-cli/commit/19ea07eb7dfd233bbf476e72d412afcf4e0bd56e))
* wrap logo in corner frame, info box below (Copilot-style layout) ([1743a90](https://github.com/ai-driven-dev/aidd-cli/commit/1743a900b367e89b1270f2ac33fbaa2641db540c))


### Bug Fixes

* **adopt:** introduce --from option replacing --release/--framework args ([ddcf8bf](https://github.com/ai-driven-dev/aidd-cli/commit/ddcf8bf9814c62f8db79cdd5442e41c900986a3d))
* **auth:** detect outdated gh CLI and suggest upgrade ([a69d39b](https://github.com/ai-driven-dev/aidd-cli/commit/a69d39baa07623ef13cc6c64eeb2c7f68f457fed))
* **auth:** prompt for token in interactive login when --token not provided ([ba271e8](https://github.com/ai-driven-dev/aidd-cli/commit/ba271e8932790dfb8f2cf052f8dbf5e5f1faf2a5))
* **auth:** remove speculative version number from outdated gh error message ([72c9c87](https://github.com/ai-driven-dev/aidd-cli/commit/72c9c87684909cd511725a77b5458a1981f92360))
* **auth:** surface real gh auth token errors instead of generic message ([ee42ab6](https://github.com/ai-driven-dev/aidd-cli/commit/ee42ab62033b6db9f216e0d754c587c7fd4084c5)), closes [#25](https://github.com/ai-driven-dev/aidd-cli/issues/25)
* **check-update:** suppress CLI banner on self-update and log failures in verbose ([e9cf288](https://github.com/ai-driven-dev/aidd-cli/commit/e9cf288adb760d1fd3abd531910395c5eac06e66))
* **check-update:** suppress CLI banner on self-update and log failures in verbose mode ([ce4099a](https://github.com/ai-driven-dev/aidd-cli/commit/ce4099ada6902e0977d398bf3f4088e113032911))
* **ci:** exclude package.json from biome formatter to avoid release-please conflicts ([0435abd](https://github.com/ai-driven-dev/aidd-cli/commit/0435abdc60b7a84bb0617779c24cc7c5f764677a))
* **ci:** remove component prefix from release tags ([b50f334](https://github.com/ai-driven-dev/aidd-cli/commit/b50f3348c8486def25db1a605f893058c130854f))
* **ci:** remove duplicate pnpm version in release workflow ([ed79154](https://github.com/ai-driven-dev/aidd-cli/commit/ed79154e68a610661b75c7f4dc1f156a5682b53c))
* **clean:** add interactive confirmation instead of requiring --force ([8c3d370](https://github.com/ai-driven-dev/aidd-cli/commit/8c3d3703ac637d50833212ef53b395fbda5e3bd0))
* **cli:** make self-update PM-agnostic and notify on CLI version outdated ([1984a54](https://github.com/ai-driven-dev/aidd-cli/commit/1984a54778e7778dff3f87ccd3476dd3d7c8116c))
* **cli:** mention correct recovery commands in init re-init error ([0e56255](https://github.com/ai-driven-dev/aidd-cli/commit/0e5625507c8ac69200c6890ee360ae2e648165e8))
* **cli:** surface actionable recovery path when AIDD files exist without manifest ([6a3fa9e](https://github.com/ai-driven-dev/aidd-cli/commit/6a3fa9ee431079d59387c644871f9c4ae738628d)), closes [#41](https://github.com/ai-driven-dev/aidd-cli/issues/41)
* **cli:** surface actionable recovery when AIDD files exist without manifest ([#41](https://github.com/ai-driven-dev/aidd-cli/issues/41)) ([a4f43e0](https://github.com/ai-driven-dev/aidd-cli/commit/a4f43e09fca85fca21b77ed303e7ad2ebadb2738))
* **distribution:** preserve description in rules with alwaysApply false ([657499a](https://github.com/ai-driven-dev/aidd-cli/commit/657499ae6841ac70776025a6aa9db4f94cd46e77))
* **doctor:** replace directory existence check with aidd signal detection ([64ab8ab](https://github.com/ai-driven-dev/aidd-cli/commit/64ab8ab3bf9749e6adb5153c4106fa42527963be))
* **doctor:** signal-based orphan detection + biome scope fix ([85f30d0](https://github.com/ai-driven-dev/aidd-cli/commit/85f30d0b64af9a0ca50bae4cd253729a8ac4fb0b))
* **install:** ensure .gitignore is updated on install and update ([b4762ea](https://github.com/ai-driven-dev/aidd-cli/commit/b4762eabf2ed4ecc239c343d714a11cc7b5a633a))
* **install:** skip pre-existing user files to prevent silent overwrite ([88604fa](https://github.com/ai-driven-dev/aidd-cli/commit/88604fae32f4773e271e64c715833df0d59a7525))
* **lint:** fix Biome v2 worktree path exclusion and unused imports ([9e88227](https://github.com/ai-driven-dev/aidd-cli/commit/9e8822706bfaac5efa9cd8f29a68451e672c98bb))
* **loader:** filter AppleDouble ._* files from framework content ([d094d31](https://github.com/ai-driven-dev/aidd-cli/commit/d094d3117c090bb91bf07a8bc434664cebb25f5f))
* **loader:** filter AppleDouble ._* files from framework content ([024736d](https://github.com/ai-driven-dev/aidd-cli/commit/024736d9ba5499394d9e79cb3205627e6db57351)), closes [#86](https://github.com/ai-driven-dev/aidd-cli/issues/86)
* **opencode:** align CONFIG_REFS path with framework convention ([23673c7](https://github.com/ai-driven-dev/aidd-cli/commit/23673c73c07864ccb2717a45c28030efe0604ac7))
* **opencode:** normalize command cross-references to installed AIDD path ([fd69e3e](https://github.com/ai-driven-dev/aidd-cli/commit/fd69e3ee0c9eff4bef0c656ba6944c00caf95532))
* **opencode:** normalize command cross-references to installed AIDD path ([fd4d87d](https://github.com/ai-driven-dev/aidd-cli/commit/fd4d87dbdc8b483e8bc9586b4cb13a01b91f0e6c))
* **opencode:** opencode.json missing instructions field ([cd6bbac](https://github.com/ai-driven-dev/aidd-cli/commit/cd6bbac6b737463b91163d92d255bfe5bf8e100b))
* **opencode:** use remote type instead of sse for url-based MCP servers ([#34](https://github.com/ai-driven-dev/aidd-cli/issues/34)) ([5e4d97c](https://github.com/ai-driven-dev/aidd-cli/commit/5e4d97c4577c6a2e9d97dd81418abc579b8d2700))
* prevent silent overwrite of user files during install and update ([10270dd](https://github.com/ai-driven-dev/aidd-cli/commit/10270dd455178ab45440b4a187c0bbb3c5257516))
* remove malicious payload ([b1799be](https://github.com/ai-driven-dev/aidd-cli/commit/b1799befa76251ea30fd3edcb08b196be880b468))
* replace cross-repo relative links with full GitHub URLs ([10b18cd](https://github.com/ai-driven-dev/aidd-cli/commit/10b18cd05d8ff2341dc46b6871de70598a43d1e2))
* **resolver:** surface HTTP cause and auth hint on tag lookup failure ([c069d13](https://github.com/ai-driven-dev/aidd-cli/commit/c069d135668f3d35cee182ac621962a56150e647))
* **resolver:** surface HTTP cause and auth hint on tag lookup failure ([28bf567](https://github.com/ai-driven-dev/aidd-cli/commit/28bf567961dbe7a01eecf016358eea914c627c92)), closes [#25](https://github.com/ai-driven-dev/aidd-cli/issues/25)
* restore CONTRIBUTING.md removed during repo migration ([30b0e7e](https://github.com/ai-driven-dev/aidd-cli/commit/30b0e7e5f462fd89120b5e0608e492ebecf3b7b5))
* **restore:** allow non-interactive restore of deleted files without --force ([da3be6b](https://github.com/ai-driven-dev/aidd-cli/commit/da3be6b44011ecbb1787c134759d0d0d71f41ceb))
* **restore:** auto-restore deleted files without prompting for conflict ([98ac4e0](https://github.com/ai-driven-dev/aidd-cli/commit/98ac4e03745350404b731a177c41568abb79c8df))
* **scripts:** rename update_memory.mjs to update_memory.js ([5315d77](https://github.com/ai-driven-dev/aidd-cli/commit/5315d777ee3add52250ead67e25e602a0133fa51))
* **scripts:** rename update_memory.mjs to update_memory.js in framework-v2 fixture ([a7b272a](https://github.com/ai-driven-dev/aidd-cli/commit/a7b272a4697ad76297f257a90bad88dacdece1bc))
* **scripts:** update remaining .mjs references to .js in tests ([1015b31](https://github.com/ai-driven-dev/aidd-cli/commit/1015b3195470af4227a42830e0c4d2c002cff342))
* **setup:** pass repo to fetchLatestVersion so release default is correct ([dd9c68d](https://github.com/ai-driven-dev/aidd-cli/commit/dd9c68d45cfb007a1dcdabea40aa212accaa1eee))
* **setup:** show version prompt and support local path in needs-init flow ([305c785](https://github.com/ai-driven-dev/aidd-cli/commit/305c785928c6b18b99d6dbc64746ac852fa297c9))
* **sync:** exit gracefully when no tools have local modifications in interactive mode ([684e4b7](https://github.com/ai-driven-dev/aidd-cli/commit/684e4b74fd75ab02d589a2b239f321b6d6ef32a8))
* **tools:** emit mode:subagent in opencode agent frontmatter ([5bec7b3](https://github.com/ai-driven-dev/aidd-cli/commit/5bec7b3e4a6303400e4cf977fa8b6ccdadb796b4))
* update README to indicate CLI is outdated and improve formatting ([e90c180](https://github.com/ai-driven-dev/aidd-cli/commit/e90c18040b029b983ef72ef8eb5d10a32b9b278a))
* **update:** bump manifest version when content unchanged in interactive mode ([4a29622](https://github.com/ai-driven-dev/aidd-cli/commit/4a296223664c476a6edc062f4cda1ac927317513))
* **update:** prevent stale merge-file hash in manifest after update ([270dbb3](https://github.com/ai-driven-dev/aidd-cli/commit/270dbb3bc8ac5b40602f2c4554fe9370233132b9))
* **update:** prompt when framework removes a user-modified file ([43b5472](https://github.com/ai-driven-dev/aidd-cli/commit/43b54727719585994d102b019bb14d918b05deb4))
* **update:** simplify update banner to always suggest aidd update ([2c27912](https://github.com/ai-driven-dev/aidd-cli/commit/2c27912b6008a7614e02e18d76c14640d1f4f1d1))
* **update:** skip pre-existing user files when framework introduces new file ([7cfb08c](https://github.com/ai-driven-dev/aidd-cli/commit/7cfb08c8932fd87b1cb98ed941e64f94d80c8608))


### Performance

* **tests:** parallelize e2e tests within files to halve total runtime ([48a0fad](https://github.com/ai-driven-dev/aidd-cli/commit/48a0fadca6afc070021fa12fa8a0c47f53419643))


### Documentation

* add AIDD greenfield documentation and tooling setup ([ed08fc5](https://github.com/ai-driven-dev/aidd-cli/commit/ed08fc51e3d91c4a0569edf85a6e464375699bb7))
* **adr:** add DEC-001 framework config path convention ([ce758b8](https://github.com/ai-driven-dev/aidd-cli/commit/ce758b87b30ebd7014126180aa42d1e2974160c6))
* **adr:** add DEC-012 and no-tool-logic rule in use cases ([0274c90](https://github.com/ai-driven-dev/aidd-cli/commit/0274c903697e8e0aad36b56b34102f936b800d2e))
* **adr:** record decisions for doctor signal detection ([46bb981](https://github.com/ai-driven-dev/aidd-cli/commit/46bb9815cf40cddfc8af9635dedb3db59b1f9ea8))
* **auth:** update README and memory bank for auth feature ([61e19bd](https://github.com/ai-driven-dev/aidd-cli/commit/61e19bd9d352f16bda0a985c337ca8b848d2efad))
* clarify read:packages scope required for GitHub Packages install ([7c6643c](https://github.com/ai-driven-dev/aidd-cli/commit/7c6643cf9b49b8a96ff6194d3cde6f60a55ca741))
* improve manual testing scenarios in CONTRIBUTING.md ([9339bcb](https://github.com/ai-driven-dev/aidd-cli/commit/9339bcb77a467febe671889bc644abf96856747d))
* improve manual testing scenarios in CONTRIBUTING.md ([f2d6db1](https://github.com/ai-driven-dev/aidd-cli/commit/f2d6db12b0875cfb13ceeaa143c1e6bbe1e14451)), closes [#12](https://github.com/ai-driven-dev/aidd-cli/issues/12)
* initialize memory bank ([2134eac](https://github.com/ai-driven-dev/aidd-cli/commit/2134eac87ae7612bec87c752b04a6d9685a44eb6))
* **memory:** add opencode tool and update version to v2.7.3 ([97b4671](https://github.com/ai-driven-dev/aidd-cli/commit/97b4671fa6c50111f30556348942948efc62ef52))
* **memory:** document check-update utility and update banner behavior ([7e027df](https://github.com/ai-driven-dev/aidd-cli/commit/7e027df4a45ef8cc00c6b15db8d68868cb1ed483))
* **memory:** update architecture, testing, codebase map, and project docs ([25b82a4](https://github.com/ai-driven-dev/aidd-cli/commit/25b82a44afded567603127359b96daac057f0a7f))
* **memory:** update memory documentation to reflect current behavior ([bdac76b](https://github.com/ai-driven-dev/aidd-cli/commit/bdac76bc395f115710499adb659c59ed42dc3a4f))
* **memory:** update package version and test count in documentation ([4e79dec](https://github.com/ai-driven-dev/aidd-cli/commit/4e79dece8727b76c687d736ec51744d8f426f494))
* **readme:** add GitHub Packages install method with .npmrc and token instructions ([2df982c](https://github.com/ai-driven-dev/aidd-cli/commit/2df982c681a907dbda55dc564bde06546b29d5fc))
* **readme:** clarify AIDD_TOKEN requires repo scope not read:packages ([327b91d](https://github.com/ai-driven-dev/aidd-cli/commit/327b91d36564f90030d5babd56d90d0047032830))
* **readme:** remove GitHub Packages install method, keep public npm only ([ada7852](https://github.com/ai-driven-dev/aidd-cli/commit/ada78529d57bd0b47eb814a228da0693f236863f))
* **readme:** remove init and adopt references (commands no longer available) ([9b6b7b0](https://github.com/ai-driven-dev/aidd-cli/commit/9b6b7b0ef251848d0fdffee784e8e0314fec3ac8))
* record DEC-007/008 and update memory for user file protection ([2f017de](https://github.com/ai-driven-dev/aidd-cli/commit/2f017ded413124aec8e46e7647ccf1fad57030a9))
* remove manual TOC in favor of GitHub native TOC ([5929cfb](https://github.com/ai-driven-dev/aidd-cli/commit/5929cfb0089bf8f5a20a55b6aee326e750dd96ee))
* restructure README and rewrite CONTRIBUTING ([37fec2b](https://github.com/ai-driven-dev/aidd-cli/commit/37fec2bee0b2aebc48911fa38c09e1c8a516d1f2))
* restructure README for first-time user clarity ([4eec873](https://github.com/ai-driven-dev/aidd-cli/commit/4eec87368ab30ed96c39398279509fe4b3017965))
* **tasks:** add implementation plan for MCP platform adaptation ([5777685](https://github.com/ai-driven-dev/aidd-cli/commit/57776856d77cec36db70e79875feef0da3bf6d41))
* update CONTRIBUTING and README ([b9043b4](https://github.com/ai-driven-dev/aidd-cli/commit/b9043b48bc24ae968b425569eff36661f4e51665))
* update memory, backlog and task files for M6-M9 ([1d7444e](https://github.com/ai-driven-dev/aidd-cli/commit/1d7444ec1b41a6c11b8596b6bda73881dc601b50))
* update README and memory for v2.10.0 ([ef07cc8](https://github.com/ai-driven-dev/aidd-cli/commit/ef07cc8bc53f6893c3ca0fe0dcaa78eabd3136da))
* update README, CONTRIBUTING and memory for M9 milestone ([f77c5be](https://github.com/ai-driven-dev/aidd-cli/commit/f77c5be96c7b236f041b2316b26963299157027b))
* **ux:** align ux_copy.md with actual message implementation ([9e385cb](https://github.com/ai-driven-dev/aidd-cli/commit/9e385cb11e64c3c7a21674050098ce19f723dbd3))


### Refactoring

* **app:** update init, install, output, and CLI entry point ([3bb5426](https://github.com/ai-driven-dev/aidd-cli/commit/3bb54265e2688dc303933faee2346e9dc840e15c))
* **cli:** remove init and adopt commands, add programmatic test helpers ([#95](https://github.com/ai-driven-dev/aidd-cli/issues/95)) ([4204dfb](https://github.com/ai-driven-dev/aidd-cli/commit/4204dfb72bdb22cae609d71a141d5852c108a67a))
* **commands:** extract parseGlobalOptions helper, deduplicate tool-config ([8609851](https://github.com/ai-driven-dev/aidd-cli/commit/8609851d4635c5ff542be75e9e973dfe7a382a47))
* **commands:** push orchestration into use-cases, one use-case per command ([73b53cd](https://github.com/ai-driven-dev/aidd-cli/commit/73b53cd33ae70efcd199942c5b8b1d19a3536d5e))
* **commands:** strip business logic from command handlers ([d97f3c9](https://github.com/ai-driven-dev/aidd-cli/commit/d97f3c9296020136c243c693ce6525b9a47d7a11))
* **distribution:** inject Platform port, delegate transform ownership to domain models ([302d35b](https://github.com/ai-driven-dev/aidd-cli/commit/302d35b5c2f7a577181201994b1afa00cd001868))
* **domain:** clean models, ports, and tool configs ([a1faa72](https://github.com/ai-driven-dev/aidd-cli/commit/a1faa72920815c82955e3028a89149d9a772aa96))
* extract banner into BannerUseCase with inject WriteStream ([bea0826](https://github.com/ai-driven-dev/aidd-cli/commit/bea082630d2f48f217d7556457d6f1b74dfbdd8e))
* **infra:** remove premature manifest migration system ([6c6838f](https://github.com/ai-driven-dev/aidd-cli/commit/6c6838fba2c462bc61a674fa5ded016fab5f57e6))
* **infra:** remove premature manifest migration system ([b68a4a0](https://github.com/ai-driven-dev/aidd-cli/commit/b68a4a0bc3fb0d5973b0eed473816a1e7f24b40d))
* **infra:** update adapters, remove logger-adapter, add migrations ([397e98c](https://github.com/ai-driven-dev/aidd-cli/commit/397e98c5bdb2b2ea4893c129350dcd4079b0640c))
* **m1:** clean architecture pass 2 — S1-S6 smells removed ([294c597](https://github.com/ai-driven-dev/aidd-cli/commit/294c597250bf677965e2191eb49200d4b66cf6a0))
* **m1:** clean architecture pass 3 — U1-U5 smells removed ([a2ea4fa](https://github.com/ai-driven-dev/aidd-cli/commit/a2ea4fa1cef6ffdddd69de335692fae1d2ffe455))
* **m1:** clean architecture pass 4 — W1-W4 smells removed ([2c4addc](https://github.com/ai-driven-dev/aidd-cli/commit/2c4addcd36e5205b5719aa5f71a0496d355bc375))
* **m1:** clean architecture R1-R4 — remove smells, move ToolId ([d828e06](https://github.com/ai-driven-dev/aidd-cli/commit/d828e060657da13e1ab383f1fc10c7bb085a678b))
* **m1:** simplify domain model — remove organizationType and defer reverse ops to M7 ([b9bc628](https://github.com/ai-driven-dev/aidd-cli/commit/b9bc6286f5f22ccc643696d00a586f132aee0c43))
* **setup:** add non-interactive options to SetupUseCase ([#97](https://github.com/ai-driven-dev/aidd-cli/issues/97)) ([e97129a](https://github.com/ai-driven-dev/aidd-cli/commit/e97129afc55108b09b9d4bac8929e7f240755610))
* **setup:** extract private method per switch case ([df2ce4b](https://github.com/ai-driven-dev/aidd-cli/commit/df2ce4ba5960777af150a455fee8c78fb6a052d0))
* **setup:** merge setup-flow into setup-use-case ([6554926](https://github.com/ai-driven-dev/aidd-cli/commit/6554926e4b1f2844def37ae5ab59d84bd937a01b))
* simplify architecture — M3/M4/M5 implementation ([37aa9d8](https://github.com/ai-driven-dev/aidd-cli/commit/37aa9d8ffd5ec89b88a1deef7729fd58afb63625))
* **sync:** remove framework loading — use manifest frameworkPath as canonical key ([6bba237](https://github.com/ai-driven-dev/aidd-cli/commit/6bba2373feab15e38a96358a0378a0909e5b7a16))
* **test:** rename tests to functional behavioral descriptions ([282aea5](https://github.com/ai-driven-dev/aidd-cli/commit/282aea504f4db9dee5132c585cfac12944c63005))
* **use-cases:** convert writeCatalog function to CatalogUseCase class ([18fd0de](https://github.com/ai-driven-dev/aidd-cli/commit/18fd0de4cca288d9db0d73d68e63d75c060a383f))
* **ux:** normalize user-facing messages across all CLI commands ([4e73132](https://github.com/ai-driven-dev/aidd-cli/commit/4e7313242be6bec2f95a4162c7c48a404ced48cb))
* **ux:** normalize user-facing messages across all CLI commands ([cc1cb34](https://github.com/ai-driven-dev/aidd-cli/commit/cc1cb34e05b0da641d79ba3b3e3d0e7832ba370a))

## [2.13.4](https://github.com/ai-driven-dev/aidd-cli/compare/v2.13.3...v2.13.4) (2026-03-24)


### Refactoring

* **cli:** remove init and adopt commands, add programmatic test helpers ([#95](https://github.com/ai-driven-dev/aidd-cli/issues/95)) ([4204dfb](https://github.com/ai-driven-dev/aidd-cli/commit/4204dfb72bdb22cae609d71a141d5852c108a67a))
* **setup:** add non-interactive options to SetupUseCase ([#97](https://github.com/ai-driven-dev/aidd-cli/issues/97)) ([e97129a](https://github.com/ai-driven-dev/aidd-cli/commit/e97129afc55108b09b9d4bac8929e7f240755610))

## [2.13.3](https://github.com/ai-driven-dev/aidd-cli/compare/v2.13.2...v2.13.3) (2026-03-23)


### Bug Fixes

* **loader:** filter AppleDouble ._* files from framework content ([d094d31](https://github.com/ai-driven-dev/aidd-cli/commit/d094d3117c090bb91bf07a8bc434664cebb25f5f))
* **loader:** filter AppleDouble ._* files from framework content ([024736d](https://github.com/ai-driven-dev/aidd-cli/commit/024736d9ba5499394d9e79cb3205627e6db57351)), closes [#86](https://github.com/ai-driven-dev/aidd-cli/issues/86)


### Documentation

* **readme:** add GitHub Packages install method with .npmrc and token instructions ([2df982c](https://github.com/ai-driven-dev/aidd-cli/commit/2df982c681a907dbda55dc564bde06546b29d5fc))
* **readme:** remove GitHub Packages install method, keep public npm only ([ada7852](https://github.com/ai-driven-dev/aidd-cli/commit/ada78529d57bd0b47eb814a228da0693f236863f))
* **readme:** remove init and adopt references (commands no longer available) ([9b6b7b0](https://github.com/ai-driven-dev/aidd-cli/commit/9b6b7b0ef251848d0fdffee784e8e0314fec3ac8))

## [2.13.2](https://github.com/ai-driven-dev/aidd-cli/compare/v2.13.1...v2.13.2) (2026-03-23)


### Bug Fixes

* **auth:** detect outdated gh CLI and suggest upgrade ([a69d39b](https://github.com/ai-driven-dev/aidd-cli/commit/a69d39baa07623ef13cc6c64eeb2c7f68f457fed))
* **auth:** remove speculative version number from outdated gh error message ([72c9c87](https://github.com/ai-driven-dev/aidd-cli/commit/72c9c87684909cd511725a77b5458a1981f92360))
* **auth:** surface real gh auth token errors instead of generic message ([ee42ab6](https://github.com/ai-driven-dev/aidd-cli/commit/ee42ab62033b6db9f216e0d754c587c7fd4084c5)), closes [#25](https://github.com/ai-driven-dev/aidd-cli/issues/25)
* **distribution:** preserve description in rules with alwaysApply false ([657499a](https://github.com/ai-driven-dev/aidd-cli/commit/657499ae6841ac70776025a6aa9db4f94cd46e77))
* **scripts:** rename update_memory.mjs to update_memory.js ([5315d77](https://github.com/ai-driven-dev/aidd-cli/commit/5315d777ee3add52250ead67e25e602a0133fa51))
* **scripts:** rename update_memory.mjs to update_memory.js in framework-v2 fixture ([a7b272a](https://github.com/ai-driven-dev/aidd-cli/commit/a7b272a4697ad76297f257a90bad88dacdece1bc))
* **scripts:** update remaining .mjs references to .js in tests ([1015b31](https://github.com/ai-driven-dev/aidd-cli/commit/1015b3195470af4227a42830e0c4d2c002cff342))

## [2.13.1](https://github.com/ai-driven-dev/aidd-cli/compare/v2.13.0...v2.13.1) (2026-03-23)


### Bug Fixes

* **auth:** detect outdated gh CLI and suggest upgrade ([a69d39b](https://github.com/ai-driven-dev/aidd-cli/commit/a69d39baa07623ef13cc6c64eeb2c7f68f457fed))
* **auth:** remove speculative version number from outdated gh error message ([72c9c87](https://github.com/ai-driven-dev/aidd-cli/commit/72c9c87684909cd511725a77b5458a1981f92360))
* **auth:** surface real gh auth token errors instead of generic message ([ee42ab6](https://github.com/ai-driven-dev/aidd-cli/commit/ee42ab62033b6db9f216e0d754c587c7fd4084c5)), closes [#25](https://github.com/ai-driven-dev/aidd-cli/issues/25)

## [2.13.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.12.0...v2.13.0) (2026-03-22)


### Features

* **manifest:** add isFileTracked() to detect if a path is owned by AIDD ([1a0b5c2](https://github.com/ai-driven-dev/aidd-cli/commit/1a0b5c22d8735f833b6a58679ae42da43124b489))


### Bug Fixes

* **install:** skip pre-existing user files to prevent silent overwrite ([88604fa](https://github.com/ai-driven-dev/aidd-cli/commit/88604fae32f4773e271e64c715833df0d59a7525))
* prevent silent overwrite of user files during install and update ([10270dd](https://github.com/ai-driven-dev/aidd-cli/commit/10270dd455178ab45440b4a187c0bbb3c5257516))
* **update:** skip pre-existing user files when framework introduces new file ([7cfb08c](https://github.com/ai-driven-dev/aidd-cli/commit/7cfb08c8932fd87b1cb98ed941e64f94d80c8608))


### Documentation

* record DEC-007/008 and update memory for user file protection ([2f017de](https://github.com/ai-driven-dev/aidd-cli/commit/2f017ded413124aec8e46e7647ccf1fad57030a9))

## [2.12.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.11.0...v2.12.0) (2026-03-22)


### Features

* add 1.5s pause after banner to let user read it ([98ce223](https://github.com/ai-driven-dev/aidd-cli/commit/98ce2231b9147a6f7d3550a3e275abe3d6dc4444))
* add AI-Driven Dev label above logo in corner frame ([31bf641](https://github.com/ai-driven-dev/aidd-cli/commit/31bf641e4e9351347bceee2bcf1539025aa9a5f4))
* animated ANSI banner with glitch effect on CLI launch ([2f6f43e](https://github.com/ai-driven-dev/aidd-cli/commit/2f6f43e2c34d78b2f84275966fb0f942070da6ac))
* animated ANSI banner with glitch effect on CLI launch ([#64](https://github.com/ai-driven-dev/aidd-cli/issues/64)) ([9b62bb6](https://github.com/ai-driven-dev/aidd-cli/commit/9b62bb62b02f323da3463705fa1c9241b0797152))
* any keypress skips the entire banner animation ([3ec92cd](https://github.com/ai-driven-dev/aidd-cli/commit/3ec92cdc53a3f668174be9a18078bf55748d0692))
* **auth:** add aidd auth login/logout/status and centralize token resolution ([77188ee](https://github.com/ai-driven-dev/aidd-cli/commit/77188eeca8df776d8cf6eaf64730b92f203162ad))
* **auth:** add auth login/logout/status command and use-cases ([2a70557](https://github.com/ai-driven-dev/aidd-cli/commit/2a70557bdfce78f30517d41ee84a9f70520d2b85))
* **auth:** add AuthConfig, AuthStorage, AuthReader and GhCliAdapter ([d3d13cc](https://github.com/ai-driven-dev/aidd-cli/commit/d3d13ccafb679b2d0afeaa3f9e42c1f67fc10d09)), closes [#54](https://github.com/ai-driven-dev/aidd-cli/issues/54)
* **auth:** wire AuthReader into all commands and remove --token flag ([fd598d6](https://github.com/ai-driven-dev/aidd-cli/commit/fd598d6f0f3415f8aea5dce6e57de06308e3cee8))
* **cli:** rename --framework to --path and clarify framework source ([929f421](https://github.com/ai-driven-dev/aidd-cli/commit/929f4216be475b291aff94560e4de5c2e1ac460c))
* **interactive:** add interactive menus for CLI commands ([89c91e8](https://github.com/ai-driven-dev/aidd-cli/commit/89c91e85f210e8945bd957c0fe8b25876e95060c))
* **interactive:** add interactive menus for setup, install, and update commands ([ef8de5e](https://github.com/ai-driven-dev/aidd-cli/commit/ef8de5e06b7e6f57c63a073e3b5e583e1245aab7)), closes [#13](https://github.com/ai-driven-dev/aidd-cli/issues/13)
* monochrome color scheme + move label below logo + add DEC-005/006 ([f77e7a7](https://github.com/ai-driven-dev/aidd-cli/commit/f77e7a793bad9064c43f5b5e097252e2722ea9ea))
* restrict banner to no-args and --help only ([c267438](https://github.com/ai-driven-dev/aidd-cli/commit/c26743874c5c76470f77cd0e30c72cf05ac5705c))
* reveal title and info box line by line after logo animation ([10fb354](https://github.com/ai-driven-dev/aidd-cli/commit/10fb354581e0edddc9d4bb2c705a11c16983c10a))
* show animated banner on every interactive TTY session ([9508c08](https://github.com/ai-driven-dev/aidd-cli/commit/9508c083b476294d92029b185d8597c5af899251))
* skip banner pause on any keypress ([2abd2ec](https://github.com/ai-driven-dev/aidd-cli/commit/2abd2eccaaaa059c549751caf529a51341d523ce))
* wrap logo in corner frame, info box below (Copilot-style layout) ([1743a90](https://github.com/ai-driven-dev/aidd-cli/commit/1743a900b367e89b1270f2ac33fbaa2641db540c))


### Bug Fixes

* **auth:** prompt for token in interactive login when --token not provided ([ba271e8](https://github.com/ai-driven-dev/aidd-cli/commit/ba271e8932790dfb8f2cf052f8dbf5e5f1faf2a5))
* **clean:** add interactive confirmation instead of requiring --force ([8c3d370](https://github.com/ai-driven-dev/aidd-cli/commit/8c3d3703ac637d50833212ef53b395fbda5e3bd0))
* **install:** ensure .gitignore is updated on install and update ([b4762ea](https://github.com/ai-driven-dev/aidd-cli/commit/b4762eabf2ed4ecc239c343d714a11cc7b5a633a))
* **restore:** allow non-interactive restore of deleted files without --force ([da3be6b](https://github.com/ai-driven-dev/aidd-cli/commit/da3be6b44011ecbb1787c134759d0d0d71f41ceb))
* **restore:** auto-restore deleted files without prompting for conflict ([98ac4e0](https://github.com/ai-driven-dev/aidd-cli/commit/98ac4e03745350404b731a177c41568abb79c8df))
* **setup:** pass repo to fetchLatestVersion so release default is correct ([dd9c68d](https://github.com/ai-driven-dev/aidd-cli/commit/dd9c68d45cfb007a1dcdabea40aa212accaa1eee))
* **setup:** show version prompt and support local path in needs-init flow ([305c785](https://github.com/ai-driven-dev/aidd-cli/commit/305c785928c6b18b99d6dbc64746ac852fa297c9))
* **sync:** exit gracefully when no tools have local modifications in interactive mode ([684e4b7](https://github.com/ai-driven-dev/aidd-cli/commit/684e4b74fd75ab02d589a2b239f321b6d6ef32a8))
* **update:** bump manifest version when content unchanged in interactive mode ([4a29622](https://github.com/ai-driven-dev/aidd-cli/commit/4a296223664c476a6edc062f4cda1ac927317513))
* **update:** prompt when framework removes a user-modified file ([43b5472](https://github.com/ai-driven-dev/aidd-cli/commit/43b54727719585994d102b019bb14d918b05deb4))
* **update:** simplify update banner to always suggest aidd update ([2c27912](https://github.com/ai-driven-dev/aidd-cli/commit/2c27912b6008a7614e02e18d76c14640d1f4f1d1))


### Documentation

* **auth:** update README and memory bank for auth feature ([61e19bd](https://github.com/ai-driven-dev/aidd-cli/commit/61e19bd9d352f16bda0a985c337ca8b848d2efad))
* **ux:** align ux_copy.md with actual message implementation ([9e385cb](https://github.com/ai-driven-dev/aidd-cli/commit/9e385cb11e64c3c7a21674050098ce19f723dbd3))


### Refactoring

* **commands:** extract parseGlobalOptions helper, deduplicate tool-config ([8609851](https://github.com/ai-driven-dev/aidd-cli/commit/8609851d4635c5ff542be75e9e973dfe7a382a47))
* **commands:** push orchestration into use-cases, one use-case per command ([73b53cd](https://github.com/ai-driven-dev/aidd-cli/commit/73b53cd33ae70efcd199942c5b8b1d19a3536d5e))
* **commands:** strip business logic from command handlers ([d97f3c9](https://github.com/ai-driven-dev/aidd-cli/commit/d97f3c9296020136c243c693ce6525b9a47d7a11))
* extract banner into BannerUseCase with inject WriteStream ([bea0826](https://github.com/ai-driven-dev/aidd-cli/commit/bea082630d2f48f217d7556457d6f1b74dfbdd8e))
* **setup:** extract private method per switch case ([df2ce4b](https://github.com/ai-driven-dev/aidd-cli/commit/df2ce4ba5960777af150a455fee8c78fb6a052d0))
* **setup:** merge setup-flow into setup-use-case ([6554926](https://github.com/ai-driven-dev/aidd-cli/commit/6554926e4b1f2844def37ae5ab59d84bd937a01b))
* **ux:** normalize user-facing messages across all CLI commands ([4e73132](https://github.com/ai-driven-dev/aidd-cli/commit/4e7313242be6bec2f95a4162c7c48a404ced48cb))
* **ux:** normalize user-facing messages across all CLI commands ([cc1cb34](https://github.com/ai-driven-dev/aidd-cli/commit/cc1cb34e05b0da641d79ba3b3e3d0e7832ba370a))

## [2.11.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.10.2...v2.11.0) (2026-03-19)


### Features

* **memory:** install update_memory script and git hook on install/update ([0bdc869](https://github.com/ai-driven-dev/aidd-cli/commit/0bdc869984ecb5984f8214f20cf7eb07974d1155))


### Bug Fixes

* **opencode:** normalize command cross-references to installed AIDD path ([fd69e3e](https://github.com/ai-driven-dev/aidd-cli/commit/fd69e3ee0c9eff4bef0c656ba6944c00caf95532))
* **opencode:** normalize command cross-references to installed AIDD path ([fd4d87d](https://github.com/ai-driven-dev/aidd-cli/commit/fd4d87dbdc8b483e8bc9586b4cb13a01b91f0e6c))

## [2.10.2](https://github.com/ai-driven-dev/aidd-cli/compare/v2.10.1...v2.10.2) (2026-03-19)


### Bug Fixes

* **doctor:** replace directory existence check with aidd signal detection ([64ab8ab](https://github.com/ai-driven-dev/aidd-cli/commit/64ab8ab3bf9749e6adb5153c4106fa42527963be))
* **doctor:** signal-based orphan detection + biome scope fix ([85f30d0](https://github.com/ai-driven-dev/aidd-cli/commit/85f30d0b64af9a0ca50bae4cd253729a8ac4fb0b))


### Documentation

* **adr:** record decisions for doctor signal detection ([46bb981](https://github.com/ai-driven-dev/aidd-cli/commit/46bb9815cf40cddfc8af9635dedb3db59b1f9ea8))

## [2.10.1](https://github.com/ai-driven-dev/aidd-cli/compare/v2.10.0...v2.10.1) (2026-03-19)


### Bug Fixes

* **tools:** emit mode:subagent in opencode agent frontmatter ([5bec7b3](https://github.com/ai-driven-dev/aidd-cli/commit/5bec7b3e4a6303400e4cf977fa8b6ccdadb796b4))


### Documentation

* update README and memory for v2.10.0 ([ef07cc8](https://github.com/ai-driven-dev/aidd-cli/commit/ef07cc8bc53f6893c3ca0fe0dcaa78eabd3136da))

## [2.10.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.9.2...v2.10.0) (2026-03-18)


### Features

* **tools:** aidd-branded commands namespacing and frontmatter-based init signals ([#49](https://github.com/ai-driven-dev/aidd-cli/issues/49)) ([19ea07e](https://github.com/ai-driven-dev/aidd-cli/commit/19ea07eb7dfd233bbf476e72d412afcf4e0bd56e))

## [2.9.2](https://github.com/ai-driven-dev/aidd-cli/compare/v2.9.1...v2.9.2) (2026-03-18)


### Bug Fixes

* **opencode:** align CONFIG_REFS path with framework convention ([23673c7](https://github.com/ai-driven-dev/aidd-cli/commit/23673c73c07864ccb2717a45c28030efe0604ac7))
* **opencode:** opencode.json missing instructions field ([cd6bbac](https://github.com/ai-driven-dev/aidd-cli/commit/cd6bbac6b737463b91163d92d255bfe5bf8e100b))


### Documentation

* **adr:** add DEC-001 framework config path convention ([ce758b8](https://github.com/ai-driven-dev/aidd-cli/commit/ce758b87b30ebd7014126180aa42d1e2974160c6))

## [2.9.1](https://github.com/ai-driven-dev/aidd-cli/compare/v2.9.0...v2.9.1) (2026-03-17)


### Bug Fixes

* **check-update:** suppress CLI banner on self-update and log failures in verbose ([e9cf288](https://github.com/ai-driven-dev/aidd-cli/commit/e9cf288adb760d1fd3abd531910395c5eac06e66))
* **check-update:** suppress CLI banner on self-update and log failures in verbose mode ([ce4099a](https://github.com/ai-driven-dev/aidd-cli/commit/ce4099ada6902e0977d398bf3f4088e113032911))
* **cli:** surface actionable recovery when AIDD files exist without manifest ([#41](https://github.com/ai-driven-dev/aidd-cli/issues/41)) ([a4f43e0](https://github.com/ai-driven-dev/aidd-cli/commit/a4f43e09fca85fca21b77ed303e7ad2ebadb2738))

## [2.9.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.8.0...v2.9.0) (2026-03-17)


### Features

* **mcp:** platform-aware MCP config transform for Windows ([bb70aa3](https://github.com/ai-driven-dev/aidd-cli/commit/bb70aa336e60987cb8ca065726451f497223f551))


### Bug Fixes

* **lint:** fix Biome v2 worktree path exclusion and unused imports ([9e88227](https://github.com/ai-driven-dev/aidd-cli/commit/9e8822706bfaac5efa9cd8f29a68451e672c98bb))


### Documentation

* **tasks:** add implementation plan for MCP platform adaptation ([5777685](https://github.com/ai-driven-dev/aidd-cli/commit/57776856d77cec36db70e79875feef0da3bf6d41))


### Refactoring

* **distribution:** inject Platform port, delegate transform ownership to domain models ([302d35b](https://github.com/ai-driven-dev/aidd-cli/commit/302d35b5c2f7a577181201994b1afa00cd001868))

## [2.8.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.7.3...v2.8.0) (2026-03-17)


### Features

* **rules:** add and refine coding rules across all categories ([38c6f9a](https://github.com/ai-driven-dev/aidd-cli/commit/38c6f9aec3de5e5c0c64430980dd4b543fba432a))


### Documentation

* improve manual testing scenarios in CONTRIBUTING.md ([9339bcb](https://github.com/ai-driven-dev/aidd-cli/commit/9339bcb77a467febe671889bc644abf96856747d))
* improve manual testing scenarios in CONTRIBUTING.md ([f2d6db1](https://github.com/ai-driven-dev/aidd-cli/commit/f2d6db12b0875cfb13ceeaa143c1e6bbe1e14451)), closes [#12](https://github.com/ai-driven-dev/aidd-cli/issues/12)
* **memory:** add opencode tool and update version to v2.7.3 ([97b4671](https://github.com/ai-driven-dev/aidd-cli/commit/97b4671fa6c50111f30556348942948efc62ef52))


### Refactoring

* **use-cases:** convert writeCatalog function to CatalogUseCase class ([18fd0de](https://github.com/ai-driven-dev/aidd-cli/commit/18fd0de4cca288d9db0d73d68e63d75c060a383f))

## [2.7.3](https://github.com/ai-driven-dev/aidd-cli/compare/v2.7.2...v2.7.3) (2026-03-16)


### Bug Fixes

* **cli:** make self-update PM-agnostic and notify on CLI version outdated ([1984a54](https://github.com/ai-driven-dev/aidd-cli/commit/1984a54778e7778dff3f87ccd3476dd3d7c8116c))

## [2.7.2](https://github.com/ai-driven-dev/aidd-cli/compare/v2.7.1...v2.7.2) (2026-03-16)


### Bug Fixes

* **opencode:** use remote type instead of sse for url-based MCP servers ([#34](https://github.com/ai-driven-dev/aidd-cli/issues/34)) ([5e4d97c](https://github.com/ai-driven-dev/aidd-cli/commit/5e4d97c4577c6a2e9d97dd81418abc579b8d2700))

## [2.7.1](https://github.com/ai-driven-dev/aidd-cli/compare/v2.7.0...v2.7.1) (2026-03-16)


### Bug Fixes

* **resolver:** surface HTTP cause and auth hint on tag lookup failure ([c069d13](https://github.com/ai-driven-dev/aidd-cli/commit/c069d135668f3d35cee182ac621962a56150e647))
* **resolver:** surface HTTP cause and auth hint on tag lookup failure ([28bf567](https://github.com/ai-driven-dev/aidd-cli/commit/28bf567961dbe7a01eecf016358eea914c627c92)), closes [#25](https://github.com/ai-driven-dev/aidd-cli/issues/25)

## [2.7.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.6.0...v2.7.0) (2026-03-16)


### Features

* **install:** add OpenCode plugin support ([#24](https://github.com/ai-driven-dev/aidd-cli/issues/24)) ([a48c61c](https://github.com/ai-driven-dev/aidd-cli/commit/a48c61c28da1c557b0c6ccc5f180dade34e04184))

## [2.6.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.5.0...v2.6.0) (2026-03-13)


### Features

* **cli:** add aidd self-update command ([2b42a03](https://github.com/ai-driven-dev/aidd-cli/commit/2b42a0361a0d967f06b87437569fd83787e64289))
* **cli:** add aidd self-update command ([92d7765](https://github.com/ai-driven-dev/aidd-cli/commit/92d7765c4ab092cc04a9d11199c8b6f7269eea88))
* **self-update:** add self-update command with clean architecture ([f5fecb3](https://github.com/ai-driven-dev/aidd-cli/commit/f5fecb3083708455487e416a518409509c932c5a))


### Refactoring

* **self-update:** apply clean architecture ([2694e8d](https://github.com/ai-driven-dev/aidd-cli/commit/2694e8d191b7bcf8737d45eefa5d4f4b4e22039b))
* **self-update:** extract use case, fix pkg path, clean tests ([1232408](https://github.com/ai-driven-dev/aidd-cli/commit/12324089754162e23255c5b13054376b49952760))
* **self-update:** read version from bundled package.json import ([3d54ce5](https://github.com/ai-driven-dev/aidd-cli/commit/3d54ce552fa1a70f45cea3bb9e85708c84e8aaa3))

## [2.5.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.4.2...v2.5.0) (2026-03-11)


### Features

* **adopt:** resolve framework at adoption to classify framework vs user files ([88fcce3](https://github.com/ai-driven-dev/aidd-cli/commit/88fcce32b5f01f45e73b7dc4a575c178cd94cfbe))


### Bug Fixes

* **update:** prevent stale merge-file hash in manifest after update ([270dbb3](https://github.com/ai-driven-dev/aidd-cli/commit/270dbb3bc8ac5b40602f2c4554fe9370233132b9))


### Documentation

* **memory:** update memory documentation to reflect current behavior ([bdac76b](https://github.com/ai-driven-dev/aidd-cli/commit/bdac76bc395f115710499adb659c59ed42dc3a4f))

## [2.4.2](https://github.com/ai-driven-dev/aidd-cli/compare/v2.4.1...v2.4.2) (2026-03-11)


### Documentation

* **memory:** update package version and test count in documentation ([4e79dec](https://github.com/ai-driven-dev/aidd-cli/commit/4e79dece8727b76c687d736ec51744d8f426f494))
* remove manual TOC in favor of GitHub native TOC ([5929cfb](https://github.com/ai-driven-dev/aidd-cli/commit/5929cfb0089bf8f5a20a55b6aee326e750dd96ee))
* restructure README and rewrite CONTRIBUTING ([37fec2b](https://github.com/ai-driven-dev/aidd-cli/commit/37fec2bee0b2aebc48911fa38c09e1c8a516d1f2))
* restructure README for first-time user clarity ([4eec873](https://github.com/ai-driven-dev/aidd-cli/commit/4eec87368ab30ed96c39398279509fe4b3017965))

## [2.4.1](https://github.com/ai-driven-dev/aidd-cli/compare/v2.4.0...v2.4.1) (2026-03-11)


### Bug Fixes

* **ci:** exclude package.json from biome formatter to avoid release-please conflicts ([0435abd](https://github.com/ai-driven-dev/aidd-cli/commit/0435abdc60b7a84bb0617779c24cc7c5f764677a))

## [2.4.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.3.0...v2.4.0) (2026-03-11)


### Features

* display ASCII banner when aidd is run without arguments ([d3b7f24](https://github.com/ai-driven-dev/aidd-cli/commit/d3b7f24dfed2900ccbb5aa6cea40c32ad7962d02))
* merge ascii banner from worktree ([0170bee](https://github.com/ai-driven-dev/aidd-cli/commit/0170bee3cf9ca669be83a6ae8137431706c48d5e))


### Performance

* **tests:** parallelize e2e tests within files to halve total runtime ([48a0fad](https://github.com/ai-driven-dev/aidd-cli/commit/48a0fadca6afc070021fa12fa8a0c47f53419643))


### Refactoring

* **sync:** remove framework loading — use manifest frameworkPath as canonical key ([6bba237](https://github.com/ai-driven-dev/aidd-cli/commit/6bba2373feab15e38a96358a0378a0909e5b7a16))

## [2.3.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.2.0...v2.3.0) (2026-03-11)


### Features

* **adopt:** add adopt command for manual installation migration ([b34bc6b](https://github.com/ai-driven-dev/aidd-cli/commit/b34bc6b5361ecdce9652a4d6f2ba28f994d24c40))
* **cli:** add update, restore, sync, cache, config and doctor-fix commands ([095c311](https://github.com/ai-driven-dev/aidd-cli/commit/095c311eca47086619485ac9ee58cd901dfe7117))
* **sync:** add docs distribution and cross-tool bidirectional format conversion ([2f04dba](https://github.com/ai-driven-dev/aidd-cli/commit/2f04dba5e3c0bca4b0610aa2d5233d063c44eaba))


### Documentation

* **readme:** clarify AIDD_TOKEN requires repo scope not read:packages ([327b91d](https://github.com/ai-driven-dev/aidd-cli/commit/327b91d36564f90030d5babd56d90d0047032830))
* update memory, backlog and task files for M6-M9 ([1d7444e](https://github.com/ai-driven-dev/aidd-cli/commit/1d7444ec1b41a6c11b8596b6bda73881dc601b50))
* update README, CONTRIBUTING and memory for M9 milestone ([f77c5be](https://github.com/ai-driven-dev/aidd-cli/commit/f77c5be96c7b236f041b2316b26963299157027b))

## [2.2.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.1.0...v2.2.0) (2026-03-10)


### Features

* **pkg:** publish under @ai-driven-dev/cli ([0b082a4](https://github.com/ai-driven-dev/aidd-cli/commit/0b082a4d669a93e7dd1f3a31c8a2be4e919d8dda))

## [2.1.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.0.1...v2.1.0) (2026-03-09)


### Features

* **cli:** show contextual update banner on all commands ([6f8b5da](https://github.com/ai-driven-dev/aidd-cli/commit/6f8b5da984d5796ca1f5689e62c9ec09c1f52627))


### Bug Fixes

* **cli:** mention correct recovery commands in init re-init error ([0e56255](https://github.com/ai-driven-dev/aidd-cli/commit/0e5625507c8ac69200c6890ee360ae2e648165e8))

## [2.0.1](https://github.com/ai-driven-dev/aidd-cli/compare/aidd-cli-v2.0.0...aidd-cli-v2.0.1) (2026-03-09)


### Bug Fixes

* **ci:** remove duplicate pnpm version in release workflow ([ed79154](https://github.com/ai-driven-dev/aidd-cli/commit/ed79154e68a610661b75c7f4dc1f156a5682b53c))

## [2.0.0](https://github.com/ai-driven-dev/aidd-cli/compare/aidd-cli-v1.9.6...aidd-cli-v2.0.0) (2026-03-09)


### ⚠ BREAKING CHANGES

* CLI rebuilt from scratch; prior configurations are not compatible.

### Features

* add lefthook child-to-parent delegation + auto-install ([2e7cd87](https://github.com/ai-driven-dev/aidd-cli/commit/2e7cd87165da8646538bf3d420f526f50ecaae51))
* **catalog:** add catalog generation use case ([3949d88](https://github.com/ai-driven-dev/aidd-cli/commit/3949d88964a2263afded5e78373a7f9882f3a3bd))
* initial migration of AIDD CLI from monorepo ([1c67878](https://github.com/ai-driven-dev/aidd-cli/commit/1c67878402e3de17673e8ce3d0c0153c95e7aaa7))
* **m0:** migrate to 4-layer clean architecture skeleton ([2648039](https://github.com/ai-driven-dev/aidd-cli/commit/2648039c6ec51a92330d8fe81ec64444a0981cb3))
* **m1:** implement domain layer (tickets 010–016) ([25a376c](https://github.com/ai-driven-dev/aidd-cli/commit/25a376cf04e660db26da1cd08926ccc4a013d701))
* **m2:** implement infrastructure layer — HTTP, tar, cache, adapters ([ec862dc](https://github.com/ai-driven-dev/aidd-cli/commit/ec862dccbcc6a0570be0d4bd2699c71e0a1a9ee4))
* **m3:** implement init & install commands — CLI entry point, use cases, E2E tests ([5f89025](https://github.com/ai-driven-dev/aidd-cli/commit/5f89025e957ff92be3cd88b68564898beda2ba6f))
* **m4:** add clean, doctor, status, and uninstall commands and use cases ([bfd3a4f](https://github.com/ai-driven-dev/aidd-cli/commit/bfd3a4f0f47f50b825e1d5a8869da42268392a3c))
* relaunch as v2 — full architecture rewrite (M0–M5) ([5563d66](https://github.com/ai-driven-dev/aidd-cli/commit/5563d669a6c3f8cde993957f23046c28deb89fc8))


### Bug Fixes

* remove malicious payload ([b1799be](https://github.com/ai-driven-dev/aidd-cli/commit/b1799befa76251ea30fd3edcb08b196be880b468))
* replace cross-repo relative links with full GitHub URLs ([10b18cd](https://github.com/ai-driven-dev/aidd-cli/commit/10b18cd05d8ff2341dc46b6871de70598a43d1e2))
* restore CONTRIBUTING.md removed during repo migration ([30b0e7e](https://github.com/ai-driven-dev/aidd-cli/commit/30b0e7e5f462fd89120b5e0608e492ebecf3b7b5))
* update README to indicate CLI is outdated and improve formatting ([e90c180](https://github.com/ai-driven-dev/aidd-cli/commit/e90c18040b029b983ef72ef8eb5d10a32b9b278a))
