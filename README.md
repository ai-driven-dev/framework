# 📦 AI-Driven Development CLI

[![npm version](https://img.shields.io/badge/npm-v1.9.5-blue)](https://github.com/ai-driven-dev/aidd/pkgs/npm/aidd)
![beta](https://img.shields.io/badge/status-beta-yellow)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

> Installe et configure le framework AI-Driven Development sur vos projets pour les IDEs IA les plus populaires.

```bash
npm install -g @ai-driven-dev/aidd
```

## 📑 Sommaire

- [Qu'est-ce que AIDD CLI ?](#-quest-ce-que-aidd-cli-)
- [Démarrage rapide](#-démarrage-rapide)
- [IDEs supportés](#-ides-supportés)
- [Commandes](#-commandes)
- [Structure générée](#-structure-générée)
- [Installation détaillée](#-installation-détaillée)
- [Contribuer](#-contribuer)

---

## ✨ Qu'est-ce que AIDD CLI ?

AIDD CLI installe le [framework AI-Driven Development](https://github.com/ai-driven-dev/aidd-framework/blob/main/README.md) sur vos projets avec un workflow de configuration personnalisé.

**Ce qui est installé :**

| Composant | Description |
|-----------|-------------|
| **Commands** | Commandes SDLC par phase (`/plan`, `/implement`, `/review`...) |
| **Agents** | Agents spécialisés (alexia, claire, kent, martin...) |
| **Rules** | Règles de codage appliquées automatiquement |
| **Skills** | Capacités réutilisables |
| **Templates** | Modèles de documents (PRD, plans, user stories...) |
| **Memory Bank** | Fichiers de contexte projet (CLAUDE.md, AGENTS.md) |
| **MCP Config** | Configuration des serveurs MCP |

---

## 🚀 Démarrage rapide

> Guide complet : [GETTING_STARTED.md](./docs/GETTING_STARTED.md)

```bash
# 1. Installer globalement
npm install -g @ai-driven-dev/aidd

# 2. Dans votre projet
cd your-project

# 3. Lancer l'installation
aidd install
```

---

## 🎯 IDEs supportés

| IDE | Status | Commands | Agents | Rules | MCP |
|-----|:------:|:--------:|:------:|:-----:|:---:|
| [Claude Code](https://claude.ai/code) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [GitHub Copilot](https://github.com/features/copilot) | ✅ | ✅ | ✅ | ✅ | ✅ |
| [Cursor](https://cursor.so) | 🔶 | ✅ | ⚠️ | ✅ | ✅ |

---

## 🔧 Commandes

### `aidd install`

Installation interactive du framework.

| Option | Description |
|--------|-------------|
| `--auto` | Installation automatique avec les défauts |
| `--full` | Installation complète (tous les composants) |
| `--force` | Écrase les fichiers existants |
| `--dry-run` | Prévisualise sans appliquer |
| `--verbose` | Logs détaillés |

### `aidd worktree`

Crée un worktree Git temporaire pour exécuter des commandes en isolation.

```bash
aidd worktree "pnpm test"
aidd worktree "feat/my-feature" "pnpm run build"
```

---

## 📁 Structure générée

Après installation, votre projet contient :

```text
your-project/
├── .aidd/
│   └── config.yml              # Configuration AIDD
│
├── .claude/                     # Hard copies pour Claude Code
│   ├── agents/
│   ├── commands/               # Par phase (01_onboard → 10_maintenance)
│   ├── rules/
│   └── skills/
│
├── .cursor/                     # Hard copies pour Cursor
│   ├── agents/
│   ├── commands/
│   ├── rules/
│   └── skills/
│
├── .github/                     # Hard copies pour GitHub Copilot
│   ├── agents/                 # *.agent.md
│   ├── instructions/           # *.instructions.md (rules)
│   ├── prompts/                # *.prompt.md (commands)
│   ├── skills/
│   └── copilot-instructions.md
│
├── .vscode/
│   └── mcp.json                # MCP config (Copilot)
│
├── aidd_docs/                   # Documentation projet
│   ├── memory/                 # Contexte projet (internal/, external/)
│   ├── tasks/                  # Historique des tâches
│   └── templates/              # Modèles de documents
│
├── .mcp.json                    # MCP config (Claude Code)
├── CLAUDE.md                    # Memory bank (Claude Code)
└── AGENTS.md                    # Memory bank (Cursor)
```

### Contenu par IDE

| Dossier | Claude Code | Cursor | Copilot |
|---------|:-----------:|:------:|:-------:|
| `.claude/` | ✅ | - | - |
| `.cursor/` | - | ✅ | - |
| `.github/` | - | - | ✅ |
| `aidd_docs/` | ✅ | ✅ | ✅ |

---

## 🔑 Installation détaillée

> Package privé, réservé aux membres Core Team.

### 1. Créer un Personal Access Token

1. [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**
3. Scope : ✅ `read:packages`
4. Copier le token

### 2. Configurer npm

```bash
# ~/.npmrc
@ai-driven-dev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

### 3. Installer

```bash
npm install -g @ai-driven-dev/aidd
aidd --version
```

---

## 👌 Contribuer

[Guide de contribution](./CONTRIBUTING.md)

---

← [Retour au repo principal](https://github.com/ai-driven-dev/aidd/blob/main/README.md)
