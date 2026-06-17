# 05 - Init architecture

Materialize the architecture from `INSTALL.md` (produced by `04-init-install-md`): the folder/route tree and reachable stubs, following the chosen pattern. Structure only - no behavior.

## Inputs

- `INSTALL.md` (produced by `04-init-install-md`) - folder tree, architecture pattern, conventions.

## Process

1. Create the directory tree exactly as `INSTALL.md` describes, following the chosen pattern.
2. For every route (front + back), create one reachable stub: navigation resolves, handlers respond empty. No business logic.
3. Apply naming / colocation conventions uniformly.

## Test

- [ ] Tree matches `INSTALL.md`; architecture conforms to the chosen pattern.
- [ ] Every route is reachable (front navigates, API responds).
- [ ] *(frontend)* Default pages exist: 404, 403.
- [ ] No business logic present (architecture-100% / business-0%).
