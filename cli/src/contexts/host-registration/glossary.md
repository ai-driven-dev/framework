# Host registration glossary

The language of the `host-registration` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Host | An AI tool with its own plugin registry and CLI: Claude Code, Codex, Copilot | `AiToolId` |
| Plugin registry | The file a host records its installed plugins in, keyed by `<plugin>@<marketplace>` | `HostPluginRegistry` |
| Marketplace registry | The file or listing a host records its known marketplaces in, by name and source | `HostMarketplaceRegistry` |
| Marketplace sources | What a host's own CLI says each marketplace points at | `HostMarketplaceSources` |
| Reading | What one registry produced: its refs, or the reason it produced none | `HostPluginRegistryReading` |
| Answer | What a registry says about one plugin: `registered`, `registered-disabled`, `not-registered`, `unanswerable` | `HostRegistrationAnswer` |
| Catalog identity | A marketplace's declared name plus its plugin set, never a path or a version | `MarketplaceCatalogIdentity` |
| Source conflict | A registered name pointing at a different catalog than the one about to be registered | `MarketplaceSourceConflict` |
| Host actions | Registering, enabling, updating and removing through the host's own CLI | `HostActions`, `HostCliAdapter` |
