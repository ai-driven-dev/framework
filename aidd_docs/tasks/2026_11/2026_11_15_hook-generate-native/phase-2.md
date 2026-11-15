---
status: done
---

# Instruction: Plugin passerelle Kilo et OpenCode V1/V2

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/skills/08-hook-generate/scripts/
│   └── write-hook.cjs                ✏️ hôtes kilo et opencode, rendu de la passerelle
└── scripts/__tests__/
    └── hook-generation.test.js       ✏️ import de la passerelle avec un ctx factice
```

## User Journey

```mermaid
flowchart TD
  A[hook.json, hôtes kilo,opencode] --> B[write-hook.cjs]
  B --> C[.opencode/plugins/name.js exporte server V1 et setup V2]
  B --> D[.kilo/plugin/name.js exporte id et server]
  C --> E[l'hôte appelle tool.execute.before]
  D --> E
  E --> F[spawn du script avec l'id de l'hôte]
  F -->|réponse bloquante| G[throw avec la raison]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    projet temporaire et script d'exemple qui bloque sur un motif => passerelles écrites: 5: system
  section Happy path
    importer la passerelle OpenCode et appeler le hook V1 avant outil => throw avec la raison du script: 5: system
    appeler setup V2 avec un ctx factice puis son hook execute.before => même blocage: 5: system
    importer la passerelle Kilo et appeler tool.execute.before => même blocage: 5: system
  section Edge case - laisser passer
    entrée qui ne correspond pas => appeler le hook => aucune exception: 1: system
  section Edge case - script en échec
    script absent ou exit non prévu => appeler le hook => l'outil passe, échec signalé: 1: system
  section Edge case - suppression
    --remove name => passerelles et script retirés: 1: cli
  section Teardown
    supprimer le dossier temporaire => aucun fichier hors tmp: 5: system
```

## Tasks to do

### `1)` Tests d'abord

> Exécuter la passerelle rendue, pas seulement la lire.

1. Ajouter les cas du Test Scope, avec `import()` du fichier rendu et un ctx factice qui enregistre les hooks V2.
2. Constater l'échec avant le rendu.

### `2)` Rendu

> Un module autonome, modules natifs seulement.

1. OpenCode : un fichier qui exporte la fonction V1 et `setup` V2 (`ctx.tool.hook("execute.before")`), ligne d'en-tête qui nomme le hook.
2. Kilo : `export default { id, server }` avec `tool.execute.before`.
3. Commune : `spawn` du script `.opencode/hooks/<name>.<ext>` ou `.kilo/hooks/<name>.<ext>`, hors du dossier des plugins, avec l'id de l'hôte depuis `directory` (V1, Kilo) ou `ctx.location.directory` (V2), payload `{tool, args, sessionID}` sur stdin, timeout nommé, `throw` sur la réponse bloquante.
4. Propriété par la ligne d'en-tête, même règle `--force` qu'en phase 1.
5. Matcher par nom d'outil natif : `bash` en V1 et Kilo, `shell` en V2.

### `3)` Preuve par mutation

> Le blocage est prouvé.

1. Retirer le `throw` ; le test de blocage passe au rouge.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | les tests d'exécution échouent avant le rendu |
| 2 | les deux formes OpenCode et la forme Kilo bloquent sur la réponse du script et laissent passer sinon |
| 3 | sans `throw`, le test de blocage échoue |
