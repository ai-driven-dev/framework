---
status: pending
---

# Instruction: Templates à responsabilité unique

Part of [`plan.md`](./plan.md).

## Architecture projection

<!-- 🔁 = modifié. Chemins sous plugins/aidd-context/skills/02-project-memory/ -->

```txt
assets/templates/memory/
├── core/
│   └── architecture.md   🔁 drop ## Structure ; Stack = libs transversales only
├── api/
│   ├── api.md            🔁 Style = surface serveur/RPC
│   └── integration.md    🔁 reframe en intégrations externes (drop ## Internal)
└── ui/
    └── navigation.md     🔁 Routing = client
```

## Tasks to do

### `1)` architecture.md — drop Structure + Stack macro-only

> `codebase-map` possède zones + entry point ; `architecture` ne les redit plus.

1. Supprimer la section `## Structure` (les 2 bullets : modules/layers + entry point).
2. Stack, bullet 2 : remplacer `<Key libraries that shape the codebase, and what each is for>` par une formulation "libs transversales uniquement ; une lib couverte par une capability (ORM, test runner, form lib) vit dans son concern, pas ici".

### `2)` integration.md — reframe en intégrations externes

> Responsabilité unique : comment ce système s'intègre à des services tiers. Le flux interne appartient à `architecture.How it fits together`.

1. Intro : remplacer "How this system talks to others: internal communication and external services." par "How this system integrates with external/third-party services."
2. Supprimer la section `## Internal`.
3. Conserver `## External services` + le diagramme mermaid (carte des intégrations externes).

### `3)` api.md — Style = serveur/RPC

> Lever l'ambiguïté "où sont définies les routes" avec navigation.

1. Style, bullet 1 : préfixer la responsabilité serveur — "Server/RPC surface: REST, GraphQL, or RPC, the framework, where server routes are defined".

### `4)` navigation.md — Routing = client

> Pendant client de api.md.

1. Routing, bullet 1 : préfixer "Client routing: the router and where client routes are defined".

## Test acceptance criteria

| Task | Acceptance criteria                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------- |
| 1    | `architecture.md` n'a plus de `## Structure` ; Stack bullet 2 ne demande plus les libs de domaine.    |
| 2    | `integration.md` n'a plus de `## Internal` ; intro parle d'intégrations externes ; External + diag présents. |
| 3    | `api.md` Style mentionne "server" / serveur.                                                          |
| 4    | `navigation.md` Routing mentionne "client".                                                           |
| 1-4  | `aidd framework build --target codex` passe sans erreur ; chaque template reste lisible seul.         |
