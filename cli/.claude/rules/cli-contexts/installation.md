---
description: Apply when the installation record, or what installs, restores, updates or reports it, changes; the installation context owns the manifest and the flows that write it into a project.
paths:
  - "src/contexts/installation/**/*.ts"
  - "tests/contexts/installation/**/*.ts"
---

# Installation

## Reason to change

- What the project records as installed, and how a tool's files are written, restored, updated or reported against that record.
- Its language is `src/contexts/installation/glossary.md`; a name in the code means what that page says.
- Its shape is the strict reference: `reference-context.md`, beside this page.

## Ports

- `ManifestRepository`, `FileMerger`, `Platform`, `PluginDistributionReader`: held here, implemented by this context's adapters. Composition hands each to the commands.
- No contract kit yet for these four. The reservations are in `aidd_docs/memory/internal/installation.md`.

## Suppliers

- `tools`: the `ToolCatalog`, each profile's capabilities and the config artifacts it consumes.
- `translate`: the canonical content and its translators. Transitional, M-S1 in `reference-context.md`.
- `host-registration`: its `contract/`, transitional, M-I1 in `reference-context.md`, with the exact imports.
- `distribution`: none. The registry, the fetch and the chosen plugins come in as values that satisfy this context's own `ports/`.
- `shared/`: errors, `Logger`, paths, the source value and the file ports.

## Never

- Import `framework/`, `telemetry/` or `presentation/`: framework asks installation for a flow, installation never asks back.
- Name a tool: a profile declares what it consumes, and restore reads the artifacts it names. A tool id in `application/` is a defect, and `tool-addition-cost.arch.test.ts` fails on it.
- Change what a command prints or writes: the use-case tests, the e2e suite and the goldens freeze the behaviour.
