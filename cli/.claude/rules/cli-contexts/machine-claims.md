---
description: Apply when a project's claim on machine-wide state is recorded, released or proven safe to delete.
paths:
  - "src/contexts/machine-claims/**/*.ts"
  - "src/composition/machine-claims.ts"
  - "tests/contexts/machine-claims/**/*.ts"
---

# Machine claims

## Reason to change

- Which projects still need what lives at machine scope: the shared framework source, user plugins, native plugin refs.
- When a destructive step on that state is safe: nothing a project does may take away what another still needs.
- The context has no glossary.

## Ports

- `UserSourceReferences`: the registry of projects that reference the shared source, one real adapter wired by `src/composition/machine-claims.ts`.
- `MachineManifest`, `MachineManifestRepository`: the machine-wide record narrowed to what a claim reads and rewrites.
- `MarketplaceListing`: the marketplaces a project registers, narrowed from the distribution registry.
- `UserScopeTool`, `PluginEnablementReach`: a tool's user-scope directory and whether enabling reaches every project.
- `contract/`: `IsWithinUserScope`, the containment proof.
- Installation, distribution and tools own the real objects behind the narrowed shapes, and the caller hands them in.

## Suppliers

- `shared/`: errors, the error describer, `Logger`, `Lock`, `FileReader`, `FileWriter`, `VersionReader`, scope, tool, `aidd-layout`, paths and the installation file value.
- No other context: it has no edge in `ALLOWED`.

## Never

- Delete a path before the proof that it sits strictly inside the owning directory.
- Block `setup`, `sync` or `clean` on a registry this CLI cannot read: the references file is a help, not an authority.
- Import installation, distribution or tools: their objects arrive through the narrowed ports.
