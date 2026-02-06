# Guide de contribution - Framework AIDD

Ce guide explique comment contribuer au framework AIDD — la source de vérité pour les agents, commandes, règles, skills et templates.

> **Rôles et permissions** : Voir le [CONTRIBUTING principal](../CONTRIBUTING.md#rôles)

---

## Prérequis

Le framework vit dans le dépôt AIDD : <https://github.com/ai-driven-dev/aidd/>

Si vous avez reçu le framework en tant que fichier zip, hébergez-le d'abord dans votre propre dépôt. Puis suivez le même workflow de contribution ci-dessous.

## Comment contribuer

### 1. Comprendre la structure

Le dossier `framework/` est la **source unique de vérité**. Tout le contenu est indépendant de l'outil (`tool-agnostic`) — aucune syntaxe spécifique à un IDE. Le CLI gère l'installation dans les projets et génère des copies adaptées à chaque IDE supporté (Claude Code, Cursor, GitHub Copilot, etc.).

```text
framework/
├── agents/       # Définitions des agents IA
├── commands/     # Commandes SDLC organisées par phase (01-10)
├── config/       # Fichiers de configuration (config.yml, mcp.json, .vscode/)
├── rules/        # Règles de codage par catégorie
├── skills/       # Définitions de skills réutilisables
├── templates/    # Templates (aidd, dev, pm, vcs, AGENTS.md, etc.)
└── README.md     # Documentation utilisateur
```

### 2. Toujours créer une Pull Request

Toute modification nécessite une Pull Request. Les changements impactent toutes les équipes utilisant le framework et doivent donc être revus avant merge.

### 3. Suivre les templates existants

Lors de l'ajout ou la modification de contenu, toujours suivre les templates existants :

| Contenu  | Template                    | Exemples    |
| -------- | --------------------------- | ----------- |
| Agent    | `templates/aidd/agent.md`   | `agents/`   |
| Commande | `templates/aidd/command.md` | `commands/` |
| Skill    | `templates/aidd/skill.md`   | `skills/`   |
| Règle    | `templates/aidd/rule.md`    | `rules/`    |

### 4. Syntaxe et conventions

Tous les fichiers source du framework utilisent la syntaxe Claude Code par défaut (`/command`, `@path`).

**Important** : Ne pas ajouter de syntaxe ou mots-clés spécifiques à un outil dans les fichiers source du framework. Le framework doit rester indépendant de l'outil — le CLI gère toute l'adaptation syntaxique lors de l'installation. En particulier :

- **Frontmatter** : uniquement des propriétés agnostiques — `name`, `description`, `argument-hint`
- **Placeholders de chemins** : les fichiers source utilisent deux placeholders résolus au build :
  - `{{TOOLS}}/` — contenu spécifique à l'outil (commands, agents, rules, skills). Résolu par IDE : `.claude/`, `.cursor/`, `.github/`.
  - `{{DOCS}}/` — chemins de documentation (templates, memory, internal, external, tasks). Résolu en `aidd_docs/`.
- **Syntaxe d'inclusion** : utiliser `@{{TOOLS}}/path` ou `@{{DOCS}}/path` — le CLI réécrit ces chemins par outil
- **`$ARGUMENTS`** : placeholder universel pour les entrées utilisateur dans les commandes
- **Pas de métadonnées spécifiques à un outil** : pas de `color`, `docs`, `model`, `alwaysApply` ou clés spécifiques à un IDE

### 5. Règles spécifiques par IDE

Les fichiers de référence syntaxique par outil vivent dans `rules/04-tooling/` :

- `ide-mapping.claude.md` — Chemins, syntaxe et frontmatter Claude Code
- `ide-mapping.cursor.md` — Chemins, syntaxe et frontmatter Cursor
- `ide-mapping.copilot.md` — Chemins, syntaxe et frontmatter GitHub Copilot

Ces fichiers décrivent ce qui fonctionne pour chaque outil (extensions de fichier, format frontmatter, configuration MCP).

## CLI et installation

Le CLI gère le cycle de vie complet de l'installation : sélection des outils, génération de copies adaptées avec la syntaxe appropriée, suivi de l'intégrité des fichiers via les hash dans `.aidd/config.yml`, et gestion des mises à jour.

Lorsque vous contribuez du nouveau contenu au framework, le CLI le détectera automatiquement et générera les copies appropriées pour chaque outil installé lors de la prochaine mise à jour.

← [Retour au framework](./README.md)
