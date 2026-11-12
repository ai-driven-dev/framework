---
description: Apply when a tool the CLI targets is added or changed, or when code asks what a tool declares; the tools context owns every profile and nothing else names a tool's facts.
paths:
  - "src/contexts/tools/**/*.ts"
  - "src/composition/tools.ts"
  - "tests/contexts/tools/**/*.ts"
  - "src/contexts/translate/application/**/*.ts"
  - "src/contexts/framework/application/**/*.ts"
---

# Tools

## Reason to change

- What a tool the CLI targets declares: where its files land, how it takes plugins, what its own plugin CLI says about itself.
- Its language is `src/contexts/tools/glossary.md`; a name in the code means what that page says.
- Its shape follows `reference-context.md`, beside this page, bar the exceptions below. The how-to is the `tools` skill.

## Boundary

- Outside callers import `tools/contract/` only. `domain/` and `application/` are the composition root's, held by Biome (`HELD_BY_BIOME`, `APPLICATION_CLOSED` in `tests/architecture/helpers.ts`).
- Use cases receive a `ToolCatalog`, built once by `wireTools()` in `src/composition/tools.ts`; none reaches a profile by import.
- A caller asks a profile a question and never reads its structure.
- Adding a tool is one profile folder under `domain/profiles/` and one line in `REGISTERED_PROFILES`, plus its id in `kernel/tool.ts` (M-T1); the conformance suite checks it. The files still in `IDENTIFIER_BASELINE` (`tests/architecture/tool-addition-cost.arch.test.ts`) name a tool outside its profile and may need it too; the list only shrinks.
- Only `src/composition/` reads `domain/`: `tools.ts`, `native-registrations.ts` and `host-registration.ts`.

## Exceptions in force

- E-T3: the `.cjs` host adapters in `assets/` keep their own `EVENTS` table, held equal to the descriptor by conformance.
- E-T4: `domain/formats/toml.ts` is the only domain file that imports a package.
- E-T7: the native section types stay here as data, in `domain/native-registration/`.
- E-T8: the generated hooks bridge keeps two property seams no test reads.
- E-T9: `translate` keeps its own list of the other hosts' manifest paths.
- E-T10: the profile folders keep their `*-paths.ts`, `*-agent.ts` and `build.ts` files.
- M-T1 to M-T3: the written id union, the catalog passed as a `tools` option, and other contexts' tests importing this context's kit (migration state).
- Each is in section 9 of `reference-context.md`, with the line it deviates from and when it goes.

## Tests

- `tests/contexts/tools/`, mirroring the source, with the profile checks in `testing/` (`profile-conformance.ts`, `profile-file-conformance.ts`).
- A profile's declared data gets no test of its own: conformance reads it. A rule over what profiles declare is a conformance check, proven once against a profile built to break it.
- A test over every tool walks `REGISTERED_PROFILES`, never a tool id.

## Never

- Register a tool from anywhere but the list, or hold a second list.
- Read a profile's structure from a caller, or guard a capability by its presence.
- Name a tool's fact in a caller: a branch on a tool id is a question the profile should answer.
