# machine-claims

Which projects still need what lives at machine scope (shared framework source, user plugins, native plugin refs), and when a destructive step on that state is safe. No glossary.

## Ports

- `UserSourceReferences`: the registry of projects referencing the shared source; one real adapter, wired by `src/composition/machine-claims.ts`.
- `MachineManifest`, `MachineManifestRepository`: the machine-wide record narrowed to what a claim reads and rewrites. `MarketplaceListing`: the marketplaces a project registers, narrowed from the distribution registry. `UserScopeTool`, `PluginEnablementReach`: a tool's user-scope directory and whether enabling reaches every project.
- `contract/user-scope-containment.ts`: `IsWithinUserScope`, the containment proof.
- Installation, distribution and tools own the real objects behind the narrowed shapes; the caller hands them in.

## Suppliers

- `shared/` only: errors, the error describer, `Logger`, `Lock`, `FileReader`, `FileWriter`, `VersionReader`, scope, tool, `aidd-layout`, paths. No edge in `ALLOWED`.

## Never

- Delete a path before the proof that it sits strictly inside the owning directory.
- Block `setup`, `sync` or `clean` on a registry this CLI cannot read: the references file helps, it is not an authority.
- Import installation, distribution or tools: their objects arrive through the narrowed ports.

## Exceptions

- Orchestration reads `machine-claims` beyond its `contract/`; closes when each flow moves into orchestration behind a claims port.
