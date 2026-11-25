# Host registration glossary

The language of the `host-registration` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Native-registration section | What a profile file declares about a tool's own plugin CLI, beside its content profile: the activation and the marketplace settings. The composition assembles the two | `NativeRegistrationSection`, `withNativeRegistration` |
| Native activation | What a tool's own plugin CLI declares about itself: its binary, where it keeps its registries and cache, its settings file | `NativeActivation`, `NativeActivationAnswers` |
| Host | An AI tool with its own plugin registry and CLI: Claude Code, Codex, Copilot | `AiToolId` |
| Plugin registry | The file a host records its installed plugins in, keyed by `<plugin>@<marketplace>` | `HostPluginRegistry` |
| Marketplace registry | The file or listing a host records its known marketplaces in, by name and source | `HostMarketplaceRegistry` |
| Marketplace sources | What a host's own CLI says each marketplace points at | `HostMarketplaceSources` |
| Reading | What one registry produced: its refs, or the reason it produced none | `HostPluginRegistryReading` |
| Catalog identity | A marketplace's declared name plus its plugin set, never a path or a version | `MarketplaceCatalogIdentity` |
| Source conflict | A registered name pointing at a different catalog than the one about to be registered | `MarketplaceSourceConflict` |
| Host actions | Registering, enabling, updating and removing through the host's own CLI | `HostActions`, `HostCliAdapter` |
| Alias | The local name a project gives a marketplace, the key of its marketplace registry | `NativeMarketplaceRegistration.alias` |
| Host name | The name the host registered the catalog under, the one the catalog declares. Every host call uses it, never the alias | `NativeMarketplaceRegistration.hostName` |
| Ref | `<plugin>@<hostName>`, the key every host's plugin registry shares | `refOnHostName`, `isRefOnHost` |
| Registration record | What aidd asked a host's own CLI to register: binary, marketplaces and plugin refs. The manifest stores it opaque | `RegistrationRecord` |
| Provenance | The source the host had when aidd registered: `registry` or `effective-list`. Absent on a legacy record, so ownership is never inferred from the name | `NativeMarketplaceRegistration.provenance` |
| Source proof | What a host's source reading proves about one catalog: `absent`, `owned` or `unproven` with the reason | `NativeMarketplaceSourceInspection` |
| Claim | A ref some project needs enabled. Owned by `machine-claims`: this context reads a view, never the store | `ClaimsView`, `WithdrawalClaimsView` |
| Foreign ref | A ref on the host under our host name that none of our claims names | `assertNoForeignNativeRefs` |
| Activation | Enabling a plugin through the host's own CLI, at the same scope it is later removed at | `HostActions.enablePlugin` |
| Source drift | The host follows a newer build (`version-behind`) or a pre-migration project cache (`unmigrated-project-source`, `unmigrated-foreign-project-source`). Never a different catalog | `MarketplaceSourceDrift` |
| Dead, live | Whether the source a registration points at still exists. `unknown` means leave it alone | `HostActions.registrationState` |
| Unanswerable | A registry that gave no reading: none to read, none established, or unreadable. Never read as empty | `answeredRegistry` |
| Strict, best-effort | Strict: a host refusal throws before the work goes on. Best-effort: a refused step becomes a warning and a `Confirmation`, and the rest runs | `throwRefusal`, `bestEffortNativeCall` |
