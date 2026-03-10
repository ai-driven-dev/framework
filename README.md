# 📦 AIDD CLI v3.0

Le **AIDD CLI** (`@ai-driven-dev/cli`) est l'installateur TypeScript du framework AI-Driven Development. Il distribue le framework AIDD de manière cohérente à travers plusieurs assistants IA (Claude Code, Cursor, GitHub Copilot), en générant les fichiers spécifiques à chaque outil et en suivant chaque installation via un manifeste basé sur des hashes MD5.

- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Utiliser le token AIDD](#utiliser-le-token-aidd)
- [Commandes](#commandes)
  - [`aidd init`](#aidd-init)
  - [Première utilisation](#première-utilisation)
  - [`aidd status`](#aidd-status)
  - [`aidd doctor`](#aidd-doctor)
  - [`aidd uninstall`](#aidd-uninstall)
  - [`aidd clean`](#aidd-clean)
  - [Options globales](#options-globales)
- [Architecture](#architecture)
- [Développement](#développement)
- [Contribuer](#contribuer)
- [Licence](#licence)

## Fonctionnalités

| Commande                    | Description                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `aidd init [--force]`       | Initialise la structure `aidd_docs/` et le manifeste (`--force` recopie les templates docs sans clean) |
| `aidd install <tools...>`   | Génère les fichiers spécifiques à chaque outil (`--all`, `--force`)                                    |
| `aidd uninstall <tools...>` | Supprime les fichiers d'un outil proprement (`--all`)                                                  |
| `aidd status [--tool]`      | Dérive fichiers vs manifest : `~` modifié, `-` supprimé, `+` ajouté                                    |
| `aidd doctor`               | Intégrité structurelle : manifest, répertoires orphelins, références cassées                           |
| `aidd clean [--force]`      | Supprime toutes les traces AIDD (dry-run sans `--force`)                                               |
| `aidd update`               | Met à jour les distributions vers la dernière version du framework (v3.1+)                             |
| `aidd restore <tool>`       | Restaure les fichiers modifiés à leur version d'origine (v3.1+)                                        |
| `aidd sync --source <tool>` | Propage les modifications d'un outil vers les autres (v3.1+)                                           |
| `aidd cache`                | Liste ou supprime les versions du framework en cache (v3.2+)                                           |
| `aidd config get/set`       | Lit ou modifie les paramètres du projet (v3.2+)                                                        |

**Options globales :** `--verbose`, `--token`, `--repo`, `--framework`, `--release`, `--release`

**Outils supportés :** Claude Code · Cursor · GitHub Copilot

## Prérequis

| Prérequis                | Version | Notes                                                                             |
| ------------------------ | ------- | --------------------------------------------------------------------------------- |
| **Node.js**              | >= 24   | [nodejs.org](https://nodejs.org) — LTS depuis octobre 2024                        |
| **Token AIDD**           | —       | Requis pour télécharger le framework                                              |
| **tar**                  | —       | Préinstallé sur macOS, Linux, WSL et Windows 10 1803+                             |
| **gh CLI** _(optionnel)_ | —       | Si installé et authentifié (`gh auth login`), le token est résolu automatiquement |

> **Windows :** fonctionne nativement sous Windows 10 1803+ (PowerShell ou cmd) et sous WSL. `tar.exe` est fourni par Windows. En cas de problème de permissions avec `npm install -g`, utiliser un terminal administrateur ou WSL.

## Installation

Le package est hébergé sur GitHub Packages. Il requiert un [token GitHub](https://github.com/settings/tokens/new) avec le scope **`read:packages`**.

**macOS / Linux / WSL :**

```bash
# Configurer le registre GitHub Packages (token avec scope read:packages)
echo "@ai-driven-dev:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<YOUR_TOKEN>" >> ~/.npmrc

# Installer globalement
npm install -g @ai-driven-dev/cli

# Vérifier l'installation
aidd --version
```

**Windows (PowerShell) :**

```powershell
# Token GitHub avec scope read:packages requis
npm config set @ai-driven-dev:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken <YOUR_TOKEN>

npm install -g @ai-driven-dev/cli
aidd --version
```

## Utiliser le token AIDD

Le token est requis à chaque téléchargement du framework (commandes `init` et `install`). Trois façons de le fournir :

**Option 1 — Variable d'environnement (recommandé)**

```bash
export AIDD_TOKEN=<YOUR_TOKEN>
aidd install claude
```

Ajouter à `~/.bashrc`, `~/.zshrc` ou `~/.profile` pour le rendre persistant.

**Option 2 — gh CLI (si déjà installé)**

```bash
gh auth login   # une seule fois
aidd install claude   # le token est résolu automatiquement
```

**Option 3 — Flag inline**

```bash
aidd install claude --token <YOUR_TOKEN>
```

## Commandes

### `aidd init`

Initialise la structure `aidd_docs/` et le manifeste `.aidd/manifest.json`.

```bash
aidd init                        # première initialisation
aidd init --docs-dir my_docs    # répertoire docs personnalisé
aidd init --force                # recopie les templates docs sans clean (préserve les outils installés)
```

### Première utilisation

```bash
# 1. Initialiser la structure docs (aidd_docs/ + manifest)
aidd init

# 2. Installer pour un ou plusieurs outils
aidd install claude cursor

# Ou tout installer d'un coup
aidd install --all
```

> `aidd install` appelle automatiquement `init` si aucun manifeste n'existe.

### `aidd status`

Compare les fichiers sur le disque avec le manifeste et affiche les écarts par outil.

```bash
aidd status                      # tous les outils
aidd status --tool claude        # filtrer par outil
```

Légende : `~` modifié · `-` supprimé · `+` ajouté (présent sur disque, non tracké)

### `aidd doctor`

Vérifie l'intégrité structurelle de l'installation. Retourne le code 1 en cas de problème (compatible CI).

```bash
aidd doctor
```

Détecte :

- Manifest absent ou corrompu (JSON invalide)
- Répertoires d'outils présents sur le disque mais non trackés dans le manifest (orphelins)
- Références cassées dans les fichiers `.md`/`.mdc` trackés (`@path` pour Claude/Cursor, liens markdown pour Copilot)

> Les fichiers supprimés ou modifiés localement sont du drift, pas des problèmes structurels — utiliser `aidd status` pour les voir.

### `aidd uninstall`

Supprime les fichiers d'un outil et retire ses entrées du manifest.

```bash
aidd uninstall cursor
aidd uninstall --all             # tous les outils installés
```

### `aidd clean`

Supprime toutes les traces AIDD du projet (fichiers générés + manifest).

```bash
aidd clean                       # dry-run : affiche ce qui sera supprimé
aidd clean --force               # suppression effective
```

### Options globales

```bash
aidd install claude --verbose            # logs détaillés
aidd install claude --token <token>      # token explicite
aidd install claude --repo owner/repo    # framework alternatif
aidd install claude --framework ./local  # framework local (dev/test)
aidd install claude --release v3.2.0    # version spécifique du framework
```

**Variables d'environnement :**

| Variable       | Description                                 |
| -------------- | ------------------------------------------- |
| `AIDD_TOKEN`   | Token d'authentification GitHub Packages    |
| `AIDD_REPO`    | Dépôt framework personnalisé (`owner/repo`) |
| `AIDD_VERBOSE` | Mode verbeux (`true`/`false`)               |

## Architecture

Architecture 3 couches (Domain → Application → Infrastructure) :

```
src/
├── cli.ts                    # Point d'entrée commander
├── domain/                   # Modèles métier + ports + tool-configs
├── application/              # Use cases + commandes commander
└── infrastructure/           # Adaptateurs + HTTP + cache + auth
```

Pour plus de détails, voir [aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md).

## Développement

```bash
# Prérequis supplémentaires pour le dev : pnpm >= 9

# Installer les dépendances
pnpm install

# Build
pnpm build

# Tests (build + vitest)
pnpm test

# Typecheck + lint
pnpm typecheck && pnpm lint

# Test local du CLI
pnpm run install:local
aidd --version
```

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le guide de contribution complet.

Les contributions de code sont ouvertes aux membres **Obsidian+** certifiés.

## Licence

Dépôt privé pour tous les membres de l'équipe AIDD.

---

← [Retour au repo principal](https://github.com/ai-driven-dev/aidd)
