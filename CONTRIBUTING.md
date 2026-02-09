# Guide de contribution - AIDD CLI

Bienvenue dans le guide de contribution du CLI AIDD !

> **Notre mission** : Rendre l'AI-Driven Development accessible avec un package complet pour les développeurs.

> **Rôles et permissions** : Voir le [CONTRIBUTING principal](https://github.com/ai-driven-dev/aidd/blob/main/CONTRIBUTING.md#rôles)

---

- [Liens utiles](#liens-utiles)
- [Comment contribuer](#comment-contribuer)
  - [1. Signaler des issues](#1-signaler-des-issues)
    - [Créer une issue parfaite](#créer-une-issue-parfaite)
    - [Projet (choisir CLI)](#projet-choisir-cli)
  - [2. Améliorer la documentation](#2-améliorer-la-documentation)
  - [3. Développer des fonctionnalités](#3-développer-des-fonctionnalités)
  - [4. Reviewer des Pull Requests](#4-reviewer-des-pull-requests)
  - [5. Merger des Pull Requests](#5-merger-des-pull-requests)
- [Setup de développement](#setup-de-développement)
  - [Prérequis](#prérequis)
  - [Authentification GitHub Packages](#authentification-github-packages)
  - [Cloner le dépôt](#cloner-le-dépôt)
  - [Installer les dépendances](#installer-les-dépendances)
- [Workflow de développement](#workflow-de-développement)
  - [1. Trouver une fonctionnalité](#1-trouver-une-fonctionnalité)
  - [2. Créer une branche](#2-créer-une-branche)
  - [Format des messages de commit](#format-des-messages-de-commit)
  - [3. Développer la fonctionnalité](#3-développer-la-fonctionnalité)
  - [4. Tester localement](#4-tester-localement)
  - [5. Écrire des tests](#5-écrire-des-tests)
  - [6. Processus de Pull Request](#6-processus-de-pull-request)
- [Publication](#publication)
  - [Prérequis publication](#prérequis-publication)
  - [Processus de publication](#processus-de-publication)

---

## Liens utiles

- [Roadmap](https://github.com/orgs/ai-driven-dev/projects/5)
- [Releases](https://github.com/ai-driven-dev/aidd/releases)
- [Issues signalées](https://github.com/ai-driven-dev/aidd/issues)

---

## Comment contribuer

### 1. Signaler des issues

**[Créer une issue](https://github.com/ai-driven-dev/aidd/issues/new/choose)**

Utilisez les templates disponibles :

- 🐛 **Bug Report** : Signaler un bug ou comportement inattendu
- ✨ **Feature Request** : Proposer une nouvelle fonctionnalité

#### Créer une issue parfaite

| **Catégorie** | **Élément** | **Description**                           |
| ------------- | ----------- | ----------------------------------------- |
| **Labels**    | `blocked`   | Approbation ou clarifications nécessaires |
|               | `ready`     | 100% prêt pour le développement           |
| **Type**      | `bug`       | Rapport de bug                            |
|               | `feature`   | Demande de fonctionnalité                 |
|               | `task`      | Tâche, question ou documentation          |

#### Projet (choisir CLI)

Vous devez toujours spécifier le projet et les métadonnées pertinentes :

| **Catégorie**   | **Élément**   | **Description**                                             |
| --------------- | ------------- | ----------------------------------------------------------- |
| **Status**      | `Todo`        | À la création de l'issue                                    |
|                 | `In progress` | Merci de respecter ceci 🙏                                  |
|                 | `Done`        | Mergé dans `main`                                           |
| **Complexité**  | `XS`          | Documentation                                               |
|                 | `S`           | Petit fix ou amélioration                                   |
|                 | `M`           | Fonctionnalité simple                                       |
|                 | `L`           | Nécessite réflexion sur l'implémentation                    |
|                 | `XL`          | Sujet complexe à discuter avec les coachs                   |
| **Priorité**    | `urgent`      | À corriger MAINTENANT ou demain                             |
|                 | `must-have`   | Sans ça, c'est pénible                                      |
|                 | `should-have` | Pas obligatoire du tout mais on aimerait bien               |

### 2. Améliorer la documentation

Les améliorations de documentation sont toujours bienvenues ! Typos, clarifications, exemples manquants...

- **Petites corrections** (typos, formatage) : PR directe sans issue
- **Ajouts majeurs** : Créer d'abord une issue pour en discuter

### 3. Développer des fonctionnalités

> Les contributions de code sont ouvertes aux membres Obsidian+ certifiés avec le flow AIDD.

### 4. Reviewer des Pull Requests

> Les reviews de code sont effectuées par les Coachs pour assurer qualité et cohérence.

1. Utilisez les outils de review GitHub pour laisser des commentaires et suggestions.
2. Renvoyez la PR à l'auteur pour modifications si nécessaire.
3. Approuvez la PR quand vous êtes satisfait.

### 5. Merger des Pull Requests

> Seuls Baptiste et Alex peuvent merger les PRs vers `main`.

---

## Setup de développement

### Prérequis

- **Node.js** : >= 20.0.0
- **pnpm** : >= 9.0.0
- **Git** : Dernière version
- **Accès GitHub** : Personal Access Token avec le scope `read:packages`

### Authentification GitHub Packages

Le package `@ai-driven-dev/aidd` est privé et hébergé sur GitHub Packages.

**1. Créer un Personal Access Token :**

1. Aller dans [GitHub Settings > Tokens (classic)](https://github.com/settings/tokens)
2. Cliquer sur **"Generate new token (classic)"**
3. Configurer :
   - **Note** : `AIDD CLI - Read`
   - **Scopes** : ✅ `read:packages`
4. Copier le token immédiatement

**2. Configurer npm :**

```bash
# Éditer ~/.npmrc
vim ~/.npmrc

# Ajouter ces lignes :
@ai-driven-dev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=ghp_your_actual_token_here
```

### Cloner le dépôt

AIDD peut être utilisé comme submodule Git. Toujours cloner avec `--recurse-submodules` :

```bash
git clone --recurse-submodules git@github.com:ai-driven-dev/aidd.git
cd aidd/cli

# Si déjà cloné sans les submodules
git submodule update --init --recursive
```

### Installer les dépendances

```bash
pnpm install
```

---

## Workflow de développement

### 1. Trouver une fonctionnalité

**📌 [Consulter le Project Board](https://github.com/orgs/ai-driven-dev/projects/5)**

1. Ouvrir la release en cours.
2. Chercher les issues dans la colonne **Ready**.
3. S'assigner sur une issue.
4. La passer en `In Progress`.
5. Créer une branche depuis `main`.
6. Utiliser le CLI.
7. Écrire les tests.
8. Tester localement.
9. Ouvrir une PR.
10. Assigner les reviewers : `Baptiste`.

### 2. Créer une branche

```bash
# Branche de fonctionnalité
git checkout -b feat/your-feature-name

# Branche de correction
git checkout -b fix/bug-description
```

### Format des messages de commit

Suivre les conventional commits :

```bash
# Fonctionnalités
feat: add worktree command with auto-cleanup
feat(install): add --skip-framework option

# Corrections
fix: resolve symlink creation on Windows
fix(prompts): correct template path resolution

# Documentation
docs: update installation guide
docs(contributing): clarify testing process

# Refactoring
refactor: simplify policy registry logic

# Tests
test: add e2e tests for worktree command

# Maintenance
chore: update dependencies
chore(ci): optimize test workflow
```

### 3. Développer la fonctionnalité

Utilisez AIDD CLI pour construire AIDD CLI 😈

**Utiliser les prompts AIDD :**

```bash
/ide:04_code:implement "<technical plan>"
/ide:06_tests:write
/ide:05_review:review_code
```

### 4. Tester localement

Ceci installera votre version locale du CLI globalement pour les tests :

```bash
# Tester le CLI localement
pnpm run install:local

# Créer un dossier de test
cd ../output-tests
mkdir test-directory
cd test-directory

# Tester votre version locale du CLI
aidd install
```

### 5. Écrire des tests

Nous visons une suite de tests de qualité professionnelle, toutes les contributions doivent inclure des tests.

| **Commande**      | **Objectif**                   | **Quand l'utiliser**        |
| ----------------- | ------------------------------ | --------------------------- |
| `pnpm test:unit`  | Tests unitaires uniquement     | Dev local, hook pre-commit  |
| `pnpm test`       | Tests E2E complets             | Avant push, CI              |
| `pnpm test:full`  | E2E complets avec pack         | Avant push, validation      |
| `pnpm test:watch` | Mode watch pour tests unitaires | Développement actif         |
| `pnpm test:debug` | E2E avec sortie verbeuse       | Débogage                    |

### 6. Processus de Pull Request

1. Pusher votre branche et ouvrir une PR vers `main` depuis le template `.github/pull_request_template.md`.
2. Assigner les reviewers (`Baptiste`, puis `Alex` si nécessaire).

---

## Publication

> Cette section est réservée aux mainteneurs avec droits de publication (Alex uniquement).
>
> Le CLI étant fortement lié aux cours de formation AIDD, Alex doit toujours être informé des changements avant publication.

### Prérequis publication

- **GitHub CLI** : Authentifié avec `gh`
- **Permissions sur le dépôt** : Créer des releases
- **Authentification NPM** : Configurée pour GitHub Packages

### Processus de publication

Utiliser le flow de release :

```bash
/flows:release
```

**Important** : Cette commande met à jour tous les numéros de version. Ne jamais modifier manuellement `package.json`.

---

← [Retour au CLI](./README.md)
