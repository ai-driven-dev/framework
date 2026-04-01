# Decision: Recursive MenuNode tree for interactive TUI

| Field   | Value                  |
| ------- | ---------------------- |
| ID      | DEC-013                |
| Date    | 2026-03-28             |
| Feature | interactive-menu       |
| Status  | Accepted               |

## Context

The interactive TUI needed a two-level grouped menu (categories → commands) with sub-submenus for config and cache. An initial flat approach used hardcoded special marker values (`__config__`, `__cache__`) to trigger deeper menus, with one private method per submenu. Adding any new sub-submenu required new methods and new marker values.

## Decision

Model the entire menu as a recursive tree of `MenuNode = MenuLeaf | MenuBranch` where branches hold `children: MenuNode[]`. Navigation is a single generic `showMenu()` + `navigateFrom()` pair that traverses any depth. The tree is declared once as a module-level constant.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Flat methods + markers (`__config__`) | Simple for 2 levels | New level = new method + new marker type | Doesn't scale; type pollution |
| Config-driven JSON file | Runtime flexibility | Overkill; config not user-facing | No runtime reconfiguration needed |

## Consequences

- Any new submenu at any depth = add a `children` field; zero navigation logic change
- `__config__`, `__cache__`, `MenuStartAt` enum type eliminated
- `navigateFrom(path: string[])` enables direct resumption at any tree node
