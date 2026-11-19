# Target map, part 5: distribution, auth, update and dissolution of `runtime`

Scope: three contexts (`distribution`, `auth`, `update`) and the fate of every non-wiring module of `cli/src/runtime/`. The figures come from an import script run on the current tree; the cited lines are those of the current tree. This document is reconciled with `00-overview.md`, which wins wherever they disagree.

## Figures that ground the choices

| Finding | Value | Source |
| --- | --- | --- |
| Files in `distribution` | 22 (application 6, domain 10, infrastructure 6) | `cli/src/contexts/distribution/` |
| Importers of `distribution` outside the context | `framework` 22 application files + 2 domain, `presentation` 7 files, wiring 2 | grep of imports |
| Imports from `distribution` to `runtime` | 6 imports in 3 files (token, http, atomic-write, user-config-dir, inject-token) | `github-raw-fetcher-adapter.ts`, `marketplace-registry-adapter.ts`, `plugin-fetcher-adapter.ts` |
| Cycle `distribution` <-> `framework` | a single file: `marketplace-add-use-case.ts:10-13` imports the types of `marketplace-remove-use-case` | same |
| Places that write the URL `https://api.github.com` | 4 (raw catalog, release resolver, token verification, CLI update) | grep |
| Implementations of "file readable by its owner only" | 3 (`auth-storage.ts:37-56`, `private-storage-adapter.ts`, `marketplace-trust-store-adapter.ts:57-62`) | reading |
| Rule "token resolution order" written | 2 times (`auth-reader-adapter.ts:32` and `auth-storage.ts:62` `readActive`) | reading |
| `LatestReleaseResolver.resolveLatest` | no caller in `src/` (only test doubles) | grep |
| `AuthReaderAdapter.resolveContext` | no caller outside its file | grep |
| Mutation floor `distribution` | 77 (lowest of the core contexts; `runtime` 90, `framework` 93) | `cli/mutation-scopes.json` |

Gap with the framing: `distribution` contains only two catalog readers (Claude format `.claude-plugin/marketplace.json` in `domain/catalog.ts`, Copilot format `.plugin/marketplace.json` in `domain/catalog-parsers/copilot-marketplace-catalog.ts`). No Codex reader was found in `distribution`; the Codex schema only appears in `runtime/assets/asset-loader.ts`. The "three formats" are therefore two formats read today.

Layout rules applied throughout (from the overview): a context exposes only `application/` and `contract/` to the others; the domain may depend on ports, never on an adapter; every use case becomes a command (one kebab-case file, one class of the same name, one public `execute(command)`, private sub-functions, no `UseCase` suffix); tests and test titles are in English.

---

## 1. Context `distribution`

### Purpose and boundary
Answers a single question: "where does the plugin content come from, and am I allowed to read it?". It owns the notion of marketplace (a named source, with a scope, a known trust, whose catalog is read) and the local retrieval of its content. It decides neither what is installed, nor registration with a host tool, nor translation.

Out of bounds: removal of a marketplace with manifest cleanup (that is installation, coordinated by `orchestration/marketplace`), native registration with a host (`host-registration`), token (`auth`).

### Ubiquitous language
Marketplace, source (github, url, git-subdir, npm, local), catalog, catalog entry, scope (project, user), trust, marketplace cache, registry, "framework" marketplace (reserved name), stale, root release (tag `v<semver>`), public repository.

### Model
| Concept | Invariants | Current source |
| --- | --- | --- |
| `Marketplace` | kebab-case name, scope `project` or `user`, valid source, immutable (`withLastFetched`, `withVersion`) | `domain/marketplace.ts:35` |
| `isMarketplaceStale` | no `lastFetched` or unreadable date means stale | `domain/marketplace.ts:130` |
| `PluginCatalog` and entries | named entry, mandatory source, `recommended` read under `metadata` | `domain/catalog.ts` |
| Copilot reader | `metadata.pluginRoot` mandatory, source = subfolder | `domain/catalog-parsers/copilot-marketplace-catalog.ts` |
| `MarketplaceSourceMode` | remote or local, non-empty local path | `domain/marketplace-source-mode.ts` |
| Reserved name `aidd-framework` | refused on manual add | `domain/marketplace.ts:13`, `marketplace-add-use-case.ts:46` |

Open point: `MarketplaceSourceMode` (remote/local) and the kernel's `PluginSource` (github/url/git-subdir/npm/local) say "where the marketplace comes from" twice. Two vocabularies for one concept: to unify or to justify in writing.

### Domain services
- Choice of the catalog reader (Copilot first, otherwise Claude): today in `plugin-catalog-repository-adapter.ts` (infra), although it is a precedence rule. To move up to the domain, the adapter only reading the file.
- Rule "relative sources = fall back to a full clone" (`hasRelativePluginSources`, `fetch-marketplace-source-use-case.ts:50-58`): already in the domain, keep.
- New: `MarketplaceAccess` (is access readable without credentials?), which absorbs the guard that lives today in `framework` (`setup-marketplace-registration-use-case.ts:66-80`, token absent then `isRepoPublic`). It is a distribution rule housed by a neighbour.

### Commands owned (application)
`FetchMarketplaceSource`, `ResolveMarketplace`, `AddMarketplace` (ex `MarketplaceAdd`), `ListMarketplaces` (ex `MarketplaceList`), `RefreshMarketplace` (ex `MarketplaceRefresh`), `RegisterFrameworkMarketplace` (ex `MarketplaceRegisterFramework`), plus `ListMarketplaceReleases` (from `framework`, via `listRootReleases`) and `AssertMarketplaceReadable` (new, see above).

### Ports (owner, consumers)
| Port | Owner | Consumers |
| --- | --- | --- |
| `MarketplaceRegistry`, `MarketplaceTrustStore`, `MarketplaceCachePort`, `PluginCatalogRepository`, `PluginFetcher`, `RawCatalogFetcher` | distribution | distribution; `MarketplaceRegistry` also read by `framework` today (16 imports), tomorrow through `application/` and `contract/` only |
| `RepositoryReader`, `ReleaseLister` | `shared/ports` (capability-named, GitHub is one adapter) | distribution (raw catalog read, root releases and public-repo check), update (release body), see decision 1 |
| `TokenProvider` | published by `auth` in `contexts/auth/contract/` | distribution and update as customers, see section 2 |
| `HttpGet` | `shared/ports` | used by the shared GitHub adapter and by the adapters of auth and update |
| `FileReader`, `FileWriter`, `Hasher`, `Logger` | `shared/ports` | imported by `distribution` (computed: 4 contexts import `FileReader`, `FileWriter` and `Hasher`) |
| `Prompter` | `orchestration` (the prompt port belongs to what asks) | not `distribution`: it does not import the prompt port; a command that needs an answer returns a result (for example "authentication required") and `orchestration` asks the user |

`MarketplaceReleaseSource` (`listRootReleases`, `isRepoPublic`) and `MarketplaceRemover` no longer exist as distribution ports. The first is replaced by the forge ports (`ReleaseLister` for `listRootReleases`; the placement of `isRepoPublic` on `RepositoryReader` is to confirm). The second disappears with the cycle (decision 3).

### Adapters and external systems
| External system | Adapter | Remark |
| --- | --- | --- |
| GitHub (contents, releases, repos API) | one adapter in `shared/infrastructure` implementing `RepositoryReader`, `ReleaseLister` (and the `/user` call that `auth` receives as its own `IdentityVerifier`, see section 2); `github-raw-fetcher-adapter.ts` stays in `distribution` as a thin `RawCatalogFetcher` over `RepositoryReader` | a single file owns the base URL (decision 1) |
| Git repositories (clone, sparse) | `plugin-fetcher-adapter.ts` via `simple-git` | |
| npm registry (`pnpm add`) | `plugin-fetcher-adapter.ts` via `execFile` | the same file mixes git and npm |
| Disk (registry, trust, cache) | `marketplace-registry-adapter.ts`, `marketplace-trust-store-adapter.ts`, `marketplace-cache-adapter.ts` | receive the user folder by constructor |
| Token injection in a URL | `inject-token.ts` (ex `runtime/git/`) | its only importer is `distribution` |

### Dependencies
Outgoing: `shared/{domain,ports}` (errors, `PluginSource`, `Scope`, file ports, forge ports) and `auth/contract` (`TokenProvider`), the edge `distribution -> auth` of the context map. No import of `framework` (which no longer exists) nor of `runtime`. Incoming: `orchestration` (scenarios, through `application/` and `contract/`), `presentation` (displays), `composition`.

### Tests
| Level | Content | Existing |
| --- | --- | --- |
| Domain unit | `Marketplace`, catalog, Copilot reader, source mode | yes, 4 files |
| Application unit | add, list, refresh, resolve, fetch, register | yes, 8 files |
| Infra integration (real disk) | registry, trust, cache, catalog repository | yes |
| Real git integration | local bare repositories for clone and subfolder | yes (`plugin-fetcher-adapter.integration`) |
| Unit with `simple-git` and `execFile` mocked | cache, auth, fail-fast, npm | yes (`plugin-fetcher-cache-and-auth`, 417 lines, `plugin-fetcher-failfast`) |
| GitHub contract (suite per forge port, run against the fake and the real adapter) | real responses recorded once, replayed by a local HTTP server behind the real `HttpClient` | absent: `github-raw-fetcher-adapter.integration` injects a `vi.fn` for `http.get`, so no real response shape |
| Catalog format contract | one real fixture per format (Claude, Copilot), checked against the schema published in `assets` | partial: synthetic fixtures; no Codex fixture |
| npm contract | one real run of `pnpm add` in a sandbox | absent (always simulated) |

What a test must provide: an injected temporary user folder (no more `AIDD_USER_CONFIG_DIR` read deep inside), a local HTTP server with an injected base URL, local bare git repositories, a test-double `TokenProvider`. Test titles in English.

Floor 77: no Stryker report is available (the temporary folder is empty) and the mutation was not run, so the cause is not measured. Hypotheses readable in the code: (a) `plugin-fetcher-adapter.ts` (200 lines, 5 kinds of source in one class) is tested through `simple-git` and `execFile` doubles that check the arguments but not the effect; (b) the HTTP adapters are tested against a `vi.fn`, so mutants on URL, headers and statuses survive if not reread. Action: run the scope, read the report per file, promise nothing before. Per the overview, the floor of a scope other than `telemetry` and `shared` is frozen during the transition (never raised, never lowered without a written reason); the measured value goes in the report, it does not move the floor, and the scope runs in the weekly cron, not per PR.

### Rules a tool can enforce
| Rule | Mechanism | Guard replaced |
| --- | --- | --- |
| No cycle between contexts | Biome `noImportCycles` (already an error) | `context-graph.arch.test.ts` (partial); the current cycle passes because it is only a type import |
| Edges between contexts only as written in the `ALLOWED` table; only `application/` and `contract/` exposed | architecture test on `ALLOWED` and `BASELINE`, in parity with Biome | `context-boundary.arch.test.ts` and the `PUBLIC_MODULES` list |
| A context imports neither `composition/` nor `shared/infrastructure` | architecture test | `context-boundary.arch.test.ts` for the "no infra import" part |
| The domain imports no adapter (ports allowed) | architecture test, Biome per path | Biome rules per path |
| `api.github.com` written in a single file | Biome rule (GritQL plugin already present in `cli/biome-plugins`) | new |
| `node:child_process` forbidden outside `infrastructure/` | Biome `noRestrictedImports` per path | new |

### Current-to-target mapping
| Current (`cli/src/contexts/distribution/`) | Action | Target |
| --- | --- | --- |
| `application/marketplace-add-use-case.ts` | rename, modify: command `AddMarketplace`, no `MarketplaceRemover` (cycle gone), a failed fetch must not leave the previous marketplace removed | `application/add-marketplace.ts` |
| `application/fetch-marketplace-source-use-case.ts` | rename | `application/fetch-marketplace-source.ts` |
| `application/resolve-marketplace-use-case.ts` | rename | `application/resolve-marketplace.ts` |
| `application/marketplace-list-use-case.ts` | rename | `application/list-marketplaces.ts` |
| `application/marketplace-refresh-use-case.ts` | rename | `application/refresh-marketplace.ts` |
| `application/marketplace-register-framework-use-case.ts` | rename | `application/register-framework-marketplace.ts` |
| (new) | create | `application/list-marketplace-releases.ts`, `application/assert-marketplace-readable.ts` |
| `domain/marketplace.ts`, `marketplace-source-mode.ts`, `catalog.ts` | keep | same (catalog: rename to `catalog-parsers/claude-marketplace-catalog.ts` for symmetry) |
| `domain/catalog-parsers/copilot-marketplace-catalog.ts` | keep | same |
| `domain/ports/{marketplace-cache,marketplace-registry,marketplace-trust-store,plugin-catalog-repository,plugin-fetcher,raw-catalog-fetcher}.ts` | move | `ports/` (same file names, beside `domain/`) |
| `infrastructure/github-raw-fetcher-adapter.ts` | keep, goes through `RepositoryReader` (no URL of its own) | same |
| `infrastructure/plugin-fetcher-adapter.ts` | split | `infrastructure/git-source-fetcher.ts` (github, url, git-subdir), `infrastructure/npm-source-fetcher.ts`, `infrastructure/plugin-fetcher-adapter.ts` (routing and local) |
| `infrastructure/marketplace-registry-adapter.ts` | keep, receives the user folder and the atomic write by constructor | same |
| `infrastructure/marketplace-trust-store-adapter.ts` | keep, writes through the shared private-storage port (decision 4) | same |
| `infrastructure/marketplace-cache-adapter.ts`, `plugin-catalog-repository-adapter.ts` | keep | same |
| `runtime/git/inject-token.ts` | move | `contexts/distribution/infrastructure/inject-token.ts` |
| `runtime/self-update/latest-release-resolver.ts` | split: `listRootReleases` and `isRepoPublic` go to the forge ports, `resolveLatest` delete | `shared/ports/` (`ReleaseLister`, `RepositoryReader`) |
| `runtime/self-update/github-release-resolver-adapter.ts` | merge | `shared/infrastructure/github-adapter.ts` (the `ReleaseLister` part) |
| `runtime/filesystem/atomic-write.ts` | move to `shared/infrastructure` (two contexts: distribution, and the user manifest adapter of `framework`) | `shared/infrastructure/atomic-write.ts`, type `AtomicWrite` in `shared/ports` |
| Tests `tests/contexts/distribution/**` (22 files) | keep, titles in English; imports of `TokenProvider` (now `auth/contract`) and forge ports change | same |
| `tests/runtime/git/inject-token*.unit.test.ts` (2 files; `git-environment` follows `telemetry`) | move | `tests/contexts/distribution/infrastructure/` |
| `tests/runtime/self-update/github-release-resolver-*.test.ts` (2 files) | move, drop the `resolveLatest` cases, fold into the forge contract suites | `tests/shared/infrastructure/` |

### Open questions and assumptions about neighbours
- Today `framework` keeps `marketplace-remove`, `marketplace-check` and the settings synchronization. With `framework` gone, they go to `installation` and `orchestration/marketplace`; the split is not verified here.
- The observed defect: `marketplace-add-use-case.ts:52` removes the old marketplace (`:80`) before the fetch of the new one (`:59`). A fetch that fails after `--overwrite` leaves the old one removed. Read, not executed: to be pinned by a characterization test before any fix (decision 3), written before the move and proven by breaking the behaviour by hand.
- `framework/setup-marketplace-source` uses `MarketplaceSourceMode`; assumed to stay with the neighbour that keeps the interactive choice (now `orchestration`).

---

## 2. Context `auth`

### Purpose and boundary
A GitHub credential: store it, find it, verify it, erase it. It does not know what it is used for: it provides a token, it makes no business call with it. `auth` and `update` are two separate contexts.

### Ubiquitous language
Credential (method `stored` with a token, or `external` with a provider), level (`user`, `project`), provider (`gh`, typed token), explicit token (`--token`), `AIDD_TOKEN`, status, logout.

### Model
| Concept | Invariants | Current source |
| --- | --- | --- |
| `AuthCredential`, `AuthConfig`, `AuthLevel` | version 1, closed method and level, `createdAt` present | `runtime/auth/auth.ts`, `auth-storage.ts` `isAuthConfig` |
| Resolution order | explicit, then `AIDD_TOKEN`, then project, then user; `external` asks the provider | `auth-reader-adapter.ts:32-60`; repeated in `auth-storage.ts:62` |
| Logout | project level erased first, then user; a hint if `external` | `auth-provider-adapter.ts:34-50` |

### Domain services
Today the logic sits in "adapters": `AuthProviderAdapter` (login, status, logout) and `AuthReaderAdapter` (resolution). The target moves them up to the domain: `CredentialResolver` (the order, written once) and `CredentialSession` (login, status, logout), with as ports the file store, the external providers and the `IdentityVerifier` port of `auth`.

### Commands owned
`AuthLogin`, `AuthLogout`, `AuthStatus` (9 to 15 lines, they delegate to `CredentialStore`). They justify a context only together with the rest: the resolution-order invariant, the permissioned storage, the verification port. Alone, they would be a subfolder. Verdict: context kept, small, because other contexts depend on its token (distribution and update as customers, plus `orchestration` through `doctor`) and the order invariant is duplicated today.

### Ports (owner, consumers)
The 8 ports of `runtime/auth/ports/` (`oauth-provider.ts` carries three), plus the shared ones used.

| Port | Owner | Consumers |
| --- | --- | --- |
| `TokenProvider` (`resolve(): Promise<string\|null>`) | `auth`, published in `contexts/auth/contract/` | distribution (2 files + 1 moved), update (1), today's `framework` (2 files, now `orchestration/doctor`); implemented by `auth` alone |
| `CredentialStore` | auth | `presentation` (display, 1 file) |
| `CredentialFileStore` | auth | auth |
| `TokenResolver`, `CliAuthProvider`, `TokenAuthProvider` | auth | auth |
| `IdentityVerifier` (token check against `/user`) | auth (single consumer, rule 8 of the overview) | auth |
| `HttpGet` | `shared/ports` | used by the shared GitHub adapter |
| Private storage | `shared/ports` (one technical port, decision 4) | auth, telemetry, distribution |

Importers of `TokenProvider`, computed: `distribution` (`github-raw-fetcher-adapter.ts`, `plugin-fetcher-adapter.ts`), `framework` (`doctor-layout-use-case.ts`, `setup-marketplace-registration-use-case.ts`), `update` (`self-updater-adapter.ts`), `runtime/auth` (implementation). Three consumer contexts. The port stays in `auth/contract/`, and rule 2 of the overview (a `contract/` file must be imported by another context) is met. If the access guard moves to `distribution` (section 1), `framework` keeps only `doctor-layout`, which becomes an `orchestration` import of `auth/contract`.

### Adapters and external systems
| System | Adapter | Remark |
| --- | --- | --- |
| `gh` CLI (`gh auth token`, 3 s timeout) | `gh-cli-adapter.ts` | tested by mocking `spawnSync` |
| GitHub API `/user` | the shared GitHub adapter, handed to `auth` by `composition` as its `IdentityVerifier` (it matches the port by shape, so `shared` imports nothing from `auth`) | replaces `gh-token-adapter.ts`; the API URL stays in one file (decision 1) |
| Disk (user or project `auth.json`) | `auth-storage.ts` | |
| OS permission commands (`chmod 0o600`, `icacls`) | today in `auth-storage.ts:37-56`, `private-storage-adapter.ts`, `marketplace-trust-store-adapter.ts:57-62` | a single owner: the shared private-storage port and adapter (decision 4) |

Safety note observed, not fixed here: `auth-storage.ts` writes the file then applies `chmod`, whereas `private-storage-adapter.ts` creates with `mode: 0o600`. The token is therefore readable according to the umask for a short moment; adopting the shared private-storage adapter removes the window.

### Dependencies
Outgoing: `shared/ports` (private storage, `HttpGet`, `Logger`), `shared/domain` (errors); `IdentityVerifier` is its own port. Incoming: `distribution` and `update` through `auth/contract` (context map edges `distribution -> auth`, `update -> auth`); `presentation` calls the commands. The user folder is received by constructor (today `userConfigDir()` reads `process.env` and `homedir()`).

### Tests
| Level | Content | Existing |
| --- | --- | --- |
| Domain unit | resolution order (explicit table x 5 sources), logout project then user | partial: `auth-reader-branches`, `auth-provider-adapter` |
| Disk integration | `AuthStorage`, file shapes | yes (`auth-storage`, `auth-storage-shape`) |
| `gh` contract | a fake `gh` executable on the `PATH` ("unknown command" failure, empty output, code != 0) | absent: the test mocks `spawnSync` |
| GitHub `/user` contract (`IdentityVerifier` suite) | recorded response replayed locally | absent (`HttpGet` double) |
| Permission contract | on POSIX, file mode read after the write; on Windows, simulated host | partial |

A test must provide: an injected temporary user folder, a controlled `PATH`, `AIDD_TOKEN` set and removed by the test itself. Test titles in English.

### Rules a tool can enforce
| Rule | Mechanism | Guard replaced |
| --- | --- | --- |
| Only `auth` reads `AIDD_TOKEN` and `auth.json` | Biome GritQL on `process.env.AIDD_TOKEN` outside the context | new |
| No secret-file write outside the shared private-storage adapter | `noRestrictedImports` of `node:fs/promises` `chmod` outside `shared/infrastructure` | new |
| No port method without a caller | knip (types); failing that `ports-are-called.arch.test.ts` | the latter is coarse and let `resolveLatest` through |

### Current-to-target mapping
| Current (`cli/src/runtime/auth/`) | Action | Target (`cli/src/`) |
| --- | --- | --- |
| `auth.ts` | rename | `contexts/auth/domain/credential.ts` |
| `auth-login-use-case.ts`, `auth-logout-use-case.ts`, `auth-status-use-case.ts` | rename to commands | `contexts/auth/application/{auth-login,auth-logout,auth-status}.ts` |
| `auth-provider-adapter.ts` | rename | `contexts/auth/domain/credential-session.ts`; logic moves up to the domain, no adapter left |
| `auth-reader-adapter.ts` | rename | `contexts/auth/domain/credential-resolver.ts`; `resolveContext` delete (no caller) |
| `auth-storage.ts` | rename | `contexts/auth/infrastructure/credential-file-store-adapter.ts`; `readActive` removed (order rule in the resolver); permissions delegated to the shared private-storage adapter |
| `gh-cli-adapter.ts` | move | `contexts/auth/infrastructure/gh-cli-adapter.ts` |
| `gh-token-adapter.ts` | merge, becomes the `/user` call of the shared GitHub adapter, wired to the `auth` port `IdentityVerifier` | `shared/infrastructure/github-adapter.ts` |
| `ports/credential-store.ts`, `credential-file-store.ts`, `oauth-provider.ts` | move | `contexts/auth/ports/` |
| (new) | create | `contexts/auth/ports/identity-verifier.ts` |
| `ports/token-provider.ts` | move | `contexts/auth/contract/token-provider.ts` |
| Tests `tests/runtime/auth/*` (11 files) | move | `tests/contexts/auth/{domain,application,infrastructure}/` |
| `tests/helpers/auth.ts`, `tests/helpers/ports/fake-auth-reader.ts` | keep, update the import | same |
| `tests/presentation/commands/auth-wiring.integration.test.ts`, `tests/presentation/display/auth-display.unit.test.ts` | keep | same |

### Open questions and assumptions about neighbours
- `presentation/commands/auth.ts` instantiates the commands with `new` (lines 70, 89, 105): in the target, `composition/` builds them and the presentation command receives them.
- A second provider (GitLab) does not exist; no code is written for it (the `CliAuthProvider` port already exists). A different forge later is another adapter of the forge ports.
- `doctor` (neighbour) reads `TokenProvider` to display "Not authenticated"; assumed to remain a read query through `auth/contract`, from `orchestration/doctor`.

---

## 3. Context `update`

### Purpose and boundary
Update of the `aidd` binary itself: what is the current version, what is the latest published, how to install it, and should the person be warned. It has nothing to do with plugins or marketplaces.

### Ubiquitous language
Current version, latest CLI release (tag `cli-v<semver>`), changelog, package manager (npm, pnpm, yarn, bun), check cache, notice, `--check`, `--dry-run`, `--force`.

### Model
| Concept | Invariants | Current source |
| --- | --- | --- |
| Update decision | stale if `compareSemver(current, latest) < 0`; `--force` reinstalls; `--check` never installs; `--dry-run` never installs | `self-update-use-case.ts:20-44` |
| Notice from the cache | never network, never a blocking error, silent if version is not semver | `check-update-use-case.ts:34-44` |
| Package-manager detection | marker in the binary path, otherwise npm | `self-updater-adapter.ts:35-75` |
| Permission error | `EPERM`/`EACCES` on stderr gives `ElevatedPermissionUpdateError` | `self-updater-adapter.ts:140-150` |

### Domain services
`UpdateDecision` (pure, extracted from `SelfUpdateUseCase`), `UpdateNotice` (cache read then comparison). The cache path (`cache/update-check.json`, fallback to the old location without `cache/`) is an infrastructure detail computed today in the use case (`check-update-use-case.ts:20-31`): to move to an `UpdateCheckCache` adapter.

### Commands owned
`SelfUpdate` (command `aidd update`), `PrintUpdateNotice` (ex `printFromCacheOnly`), `RefreshUpdateCheck` (ex `refresh`).

### Ports (owner, consumers)
| Port | Owner | Consumers |
| --- | --- | --- |
| `CliReleaseSource` (ex `SelfUpdater.fetchLatestRelease`) | update | update |
| `CliInstaller` (ex `SelfUpdater.install`) | update | update |
| `UpdateCheckCache` | update | update |
| `VersionReader` | `shared/ports` | `framework` today (9 files), update (3); adapter `CurrentVersionAdapter` also imported by `cli.ts` |
| `HttpGet`, `ReleaseLister` | `shared/ports` | see sections 1 and 2 |
| `TokenProvider` | `auth/contract` | update as customer (edge `update -> auth`) |

`SelfUpdater` mixes two responsibilities (read a release, install): to split into `CliReleaseSource` and `CliInstaller` so that each has its own contract test.

### Adapters and external systems
| System | Adapter | Remark |
| --- | --- | --- |
| npm registry (`/-/package/@ai-driven-dev/cli/dist-tags`) | `npm-registry-release-adapter.ts` | `Accept: application/json` mandatory (406 otherwise) |
| GitHub API (body of release `cli-v<version>`) | same adapter, through `ReleaseLister` (assignment of this read to `ReleaseLister` is to confirm) | changelog optional; 404 expected if private repository without token |
| Package managers (`npm i -g`, `pnpm add -g`, `yarn global add`, `bun add -g`) and `which aidd` / `where aidd` | `package-manager-installer-adapter.ts` | `execSync` |
| Disk (check cache) | `update-check-cache-adapter.ts` | |

Base URLs are set by `AIDD_SELF_UPDATE_API_BASE` and `AIDD_SELF_UPDATE_NPM_BASE` (read in the wiring). The shared GitHub adapter is one class: `composition/` builds two instances, one for `update` with its overridable base, one for the others, otherwise the test override would also redirect the marketplace fetch.

### Dependencies
Outgoing: `shared/ports` (`HttpGet`, `ReleaseLister`, `VersionReader`, `FileReader`/`FileWriter`, `Logger`), `shared/domain` (`compareSemver`, `isSemver`, errors), `auth/contract` (`TokenProvider`). Incoming: `presentation` (command `update`, display), `cli.ts` (hooks).

### Where the hooks of `cli.ts` go
`cli.ts` registers `preAction` (notice from the cache) and `postAction` (refresh after some online commands: list `ONLINE_COMMAND_PATHS`, lines 47-53). Both call `createDeps`, which builds the whole `framework` graph (the wiring file is 650 lines) to print one line. Target:
- The list of online commands and the logic "do not disturb `telemetry` nor `update`" are presentation: `presentation/hooks/update-notice-hooks.ts`, registered by `cli.ts`.
- The graph needed (cache, version, npm registry, logger) is built by `composition/update.ts`, without touching the scenarios. The gain is no longer building 40 use cases for a notice; the time saved was not measured.
- The `AIDD_SKIP_UPDATE_CHECK` switch stays read by this presentation module.

### Tests
| Level | Content | Existing |
| --- | --- | --- |
| Domain unit | decision table (`check`, `dry-run`, `force`, stale or not) | yes (`self-update-use-case.unit`) |
| Application unit | notice, missing cache, corrupt cache, old location | yes (3 `check-update*` files) |
| npm and GitHub contract | recorded responses, including 406 without `Accept` | partial: `e2e/update-check.e2e.test.ts` already starts a local server; the adapter tests use a doubled `HttpGet` |
| Installer contract | a fake `npm`/`pnpm` on the `PATH` that exits with `EACCES` | absent: `vi.mock("node:child_process")` in 2 files |

A test must provide: a local server (model already in the e2e), a controlled `PATH`, an injected user folder, an explicit `AIDD_SKIP_UPDATE_CHECK`. Test titles in English.

### Rules a tool can enforce
| Rule | Mechanism | Guard replaced |
| --- | --- | --- |
| `node:child_process` only in `infrastructure/` | Biome `noRestrictedImports` per path | new |
| `cli.ts` imports no adapter | architecture test | `context-graph` (partial) |
| `update` imports no other context than `auth` (through `auth/contract`) | architecture test on `ALLOWED` | `context-boundary.arch.test.ts` |

### Current-to-target mapping
| Current (`cli/src/runtime/self-update/`) | Action | Target (`cli/src/`) |
| --- | --- | --- |
| `self-update-use-case.ts` | split, rename to command | `contexts/update/domain/update-decision.ts` + `contexts/update/application/self-update.ts` |
| `check-update-use-case.ts` | split, rename to commands | `contexts/update/application/{print-update-notice,refresh-update-check}.ts` + `contexts/update/infrastructure/update-check-cache-adapter.ts` |
| `self-updater.ts` | split | `contexts/update/ports/{cli-release-source,cli-installer}.ts` |
| `self-updater-adapter.ts` | split | `contexts/update/infrastructure/{npm-registry-release-adapter,package-manager-installer-adapter}.ts` |
| `current-version-adapter.ts` | move | `shared/infrastructure/current-version-adapter.ts` (`framework` and `update` import the port); `cli.ts` no longer imports it |
| `latest-release-resolver.ts`, `github-release-resolver-adapter.ts` | split (resolver: `listRootReleases` and `isRepoPublic` to the forge ports, `resolveLatest` deleted) and merge (adapter into the shared GitHub adapter) | see section 1 |
| Tests `tests/runtime/self-update/*`: `check-update*` (3), `self-update-use-case`, `self-updater-adapter*` (2), `current-version-adapter` | move | `tests/contexts/update/{domain,application,infrastructure}/` |
| `tests/e2e/update-check.e2e.test.ts`, `tests/helpers/ports/fake-current-version.ts` | keep | same |

### Open questions and assumptions about neighbours
- `framework update` (update of a project's tools) and `aidd update` (the binary) carry neighbouring names; only the second belongs to this context.
- `telemetry` must never receive a notice (a hook invokes it silently): rule kept on the presentation side.

---

## 4. Dissolution of `runtime/` (outside wiring)

Importers computed by script (contexts, `presentation`, `cli.ts`, wiring; tests excluded). "port" = the kernel port implemented; its importers are counted per context.

| Current file (`cli/src/runtime/`) | Importers | Target | Reason |
| --- | --- | --- | --- |
| `assets/asset-loader.ts`, `assets/text-assets.d.ts` | wiring only; port `AssetProvider`: framework, tools, translate | `shared/infrastructure/asset-loader.ts` | three contexts consume the port; the adapter is built by `composition/` |
| `auth/*` (13 files, about 450 lines, `ports/` x8) | `presentation`, wiring, 3 contexts via `TokenProvider` | `contexts/auth/` (section 2) | one concept, one context |
| `filesystem/atomic-write.ts` | distribution (1), user manifest adapter of `framework` (by injection) | `shared/infrastructure/atomic-write.ts` | two contexts proven |
| `filesystem/file-adapter.ts` | wiring only; ports `FileReader`/`FileWriter`: distribution, framework, tools, translate | `shared/infrastructure/file-adapter.ts` | four contexts on the port |
| `filesystem/hasher-adapter.ts` | wiring only; port `Hasher`: distribution, framework, tools, translate | `shared/infrastructure/hasher-adapter.ts` | same |
| `filesystem/private-storage-adapter.ts` | wiring only; port `PrivateStorage` in `telemetry` | `shared/infrastructure/private-storage-adapter.ts`, port in `shared/ports`, taken (decision 4) | three contexts (telemetry, auth, distribution); one technical port and adapter pair replaces the three implementations |
| `git/git-environment.ts` | `telemetry` wiring only | `contexts/telemetry/infrastructure/git-environment.ts` | a single context |
| `git/inject-token.ts` | distribution only | `contexts/distribution/infrastructure/` | a single context |
| `http/http-client.ts` | port `HttpGet`: distribution, auth, update (via adapters) | port in `shared/ports/http-get.ts`, class in `shared/infrastructure/http-client.ts` | three contexts |
| `platform/platform.ts`, `platform-adapter.ts` | `framework` only (4 files) | port in `shared/ports`, adapter in `shared/infrastructure/platform-adapter.ts` | technology without business meaning (the overview lists `platform` among the shared ports); only `framework` imports it today, see unresolved item |
| `project-root/project-root.ts` | `presentation/commands/menu.ts` only | `presentation/` | a single importer, outside contexts |
| `prompter/prompter-adapter.ts` | wiring only; port `Prompter`: distribution, framework | port in `orchestration` (what asks), adapter in `presentation/terminal/prompter-adapter.ts` | the prompt port belongs to `orchestration`; the adapter is terminal interaction |
| `self-update/*` (9 files) | `cli.ts`, `presentation` (2), `framework` (2 for the resolver), wiring | `contexts/update/`, forge ports and shared GitHub adapter (sections 1 and 3) | one concept each |
| `user-config-dir.ts` | distribution, auth, update, wiring of framework (x2) and telemetry | split: pure `userConfigDirOf(env, home)` in `shared/domain/user-config-dir.ts`, the wrapper that reads the environment and the home in `composition/user-config-dir.ts`; value injected by constructor | computed once at the root; removes three hidden reads of `process.env` and `homedir()` |
| `wiring/*` (5 files) | `presentation` (13), `cli.ts` | `composition/` | composition root |

After dissolution, `shared/infrastructure/` contains 9 files (asset-loader, atomic-write, file-adapter, hasher-adapter, http-client, private-storage-adapter, current-version-adapter, platform-adapter, and the GitHub adapter), all built by `composition/` alone and imported by nothing else (rule 7).

Tests: `tests/runtime/{assets,filesystem,http}` follow their module to `tests/shared/infrastructure/`; `tests/runtime/{git,auth,self-update}` to their contexts; `tests/runtime/{platform,project-root,prompter}`, `user-config-dir.unit.test.ts`, `home-dir.unit.test.ts` and `smoke-harness-isolation.unit.test.ts` to their target above (to check file by file at move time); `tests/runtime/wiring/*` (6 files) to `tests/composition/`.

---

## Decisions

1. Forge access. Decided: not a context and not a shared port named after the vendor. Capability-named ports: `RepositoryReader` and `ReleaseLister` in `shared/ports` (two consumers, `distribution` and `update`); `IdentityVerifier` is a port of `auth`, its single consumer (rule 8 of the overview); GitHub is one adapter in `shared/infrastructure`, wired by `composition`. Two instances stay possible because of the self-update API base override. A different forge later is another adapter; nothing is written today. Only one file may contain the GitHub API URL (Biome GritQL rule). Rationale kept from the analysis: the alternative (each context keeps its own adapter and its own `https://api.github.com`) leaves 4 copies and 2 almost identical error classifications today.
2. `auth` stays a context, separate from `update`, and publishes `TokenProvider` in its `contract/`. `distribution` and `update` import it as customers (context map: `distribution -> auth`, `update -> auth`). It is no longer in `shared/ports`. The three computed importer contexts keep the file imported by other contexts, as rule 2 requires.
3. The cycle disappears with `framework`: `orchestration` sits above `distribution`, and `distribution` has no edge to `installation`. `MarketplaceRemover` is no longer a distribution port; the `--overwrite` removal is coordinated by `orchestration/marketplace`, which must remove only after the fetch succeeded. The current order (removal before fetch) is a potential defect, unexecuted, to be pinned by a characterization test first.
4. Private storage: one shared technical port in `shared/ports` and one adapter in `shared/infrastructure`, replacing the three implementations (telemetry, auth storage, trust store). Cost: changing files of `auth` and `distribution` under a write test that checks the file mode.
5. `update`: delete `resolveLatest` (no caller), move `listRootReleases` and `isRepoPublic` behind the forge ports used by `distribution`, and have the hooks of `cli.ts` build a minimal graph instead of `createDeps`.

## Assumptions about neighbours and limits

- `framework` no longer exists: it becomes `installation`, `host-registration` and `orchestration/` (scenarios). Their split is not verified here. The "framework" figures above are those of the current folder.
- Interpretation of the rule given: `shared/infrastructure` holds only adapters of shared ports, built by `composition/`, never imported by a context.
- Not verified: cause of the mutation floor 77 (no report, mutation not run); existence of a Codex reader outside `distribution`; time saved by the lighter hooks; exact behaviour on a fetch failure after `--overwrite` (read, not executed).
- Settled against the overview: (a) `distribution` consumes `Prompter` today; in the target it does not import the prompt port: the command returns a result (for example "authentication required") and `orchestration` asks the user. (b) Rule 8 (a module enters `shared` only if 2 contexts import it): `IdentityVerifier` has `auth` alone as consumer, so it is a port of `auth`; `ReleaseLister` has two (`distribution`, `update`) and stays in `shared/ports`. `platform` stays in `shared/ports` as the overview lists it, although only `framework` imports it today.
- Unresolved: (c) The exact distribution of `isRepoPublic` and of the CLI release body read among the three forge ports is to confirm.
- No test was run and nothing was modified outside this file.
