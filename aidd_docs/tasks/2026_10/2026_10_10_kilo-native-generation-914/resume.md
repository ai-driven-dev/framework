# Reprise de la contribution #914

> Document historique de préparation. État actuel : [phase 1 terminée](next-session.md), commits locaux par TASK autorisés, suite soumise à nouvelle autorisation. Le texte ci-dessous conserve les décisions de la préparation initiale.

État actualisé au 10 octobre 2026 : découverte native AIDD confirmée dans cette nouvelle session ; plan et six phases produits via la capacité installée, matrice 16/16 et challenge enregistrés. Aucun développement commencé. Validation explicite du plan en attente.

Reprise actuelle : [next-session.md](./next-session.md). Le reste de ce document décrit la préparation antérieure ; les versions et états actualisés ci-dessous dans next-session priment.

## Demande et limite d'autorisation

Source : [issue #914](https://github.com/ai-driven-dev/framework/issues/914) et handoff utilisateur conservé dans `user-request.md`.
La mission immédiate s'arrête à la présentation du plan détaillé et de sa matrice de couverture, après utilisation effective des capacités AIDD.
Ne pas implémenter avant validation du plan. Ne pas commit, push ou modifier une PR distante sans accord explicite.
Ne pas improviser un workflow parallèle pour remplacer la découverte native des skills.

## Git

- Répertoire : `/home/coder/project`.
- État initial : `main`, propre, sans changements non commités.
- Remotes conservés : origin `git@github.com:waewoo/framework.git`, upstream `git@github.com:ai-driven-dev/framework.git`.
- `git fetch upstream` exécuté avec succès après élévation : le sandbox monte `.git` en lecture seule.
- `git switch --no-track -c feat/kilo-native-generation-914 upstream/next` effectué.
- HEAD et upstream/next identiques : `41e91691b5837a8c27475d0115725131bb53bf41`.
- Aucun commit, push, PR, reset ou nettoyage effectué. Aucun fichier produit modifié.
- Les seuls nouveaux fichiers de travail sont les documents de reprise dans ce dossier.
- Future PR : cible `ai-driven-dev/framework:next`.

## Installation et vérification

Prérequis observés : Node 24.21.0, pnpm 12.3.4, jq 1.7, Python 3.14.2, pipx 1.17.2, GNU Make 4.3, Git 2.55.0.
Codex CLI : 0.162.0. Claude et Kilo absents du PATH.

README, CONTRIBUTING, AGENTS, docs/ARCHITECTURE et les dix fichiers de mémoire racine référencés par AGENTS ont été lus sur next.
Les scripts de setup/sync et lefthook ont été lus avant installation.
La mémoire de main était ancienne ; utiliser les documents de next pour la suite.

Commande exécutée : `YES=1 AIDD_CLI_VERSION=5.4.0 make setup`, code de sortie 0.
Portée : dépendances racine, hooks Git Lefthook, build Codex natif, marketplace utilisateur, neuf plugins utilisateur, deux agents TOML.
Sauvegarde préalable : `/tmp/aidd-914-backup/config.toml` et `/tmp/aidd-914-backup/git-hooks/`. Aucun répertoire agents n'existait à sauvegarder.
Ne pas restaurer aveuglément ces sauvegardes après d'autres changements utilisateur. /tmp est temporaire.

Marketplace : `/home/coder/.cache/aidd-framework-dev/codex`.
Build : `/home/coder/.cache/aidd-framework-dev/codex/plugins/<plugin>`.
Cache installé : `/home/coder/.codex/plugins/cache/aidd-framework/<plugin>/<version>/skills/<skill>/SKILL.md`.
Manifests : `.codex-plugin/plugin.json`, champ `skills: ./skills`.
Agents installés : `/home/coder/.codex/agents/checker.toml`, `executor.toml`.

`codex plugin list --marketplace aidd-framework --json` confirme neuf plugins installés et activés :
context 2.8.1 ; dev 2.6.0 ; vcs 2.4.0 ; pm 2.5.0 ; orchestrator 2.3.1 ; refine 3.1.0 ; ui 0.2.1-alpha.0 ; telemetry 0.2.1 ; qa 1.0.0.
La procédure officielle installe aussi les plugins hors chemin curaté ; aucun workflow de ces plugins n'a été invoqué.
51 SKILL.md installés ont été comparés octet par octet au build traduit : zéro différence.
La traduction change le frontmatter des sources Claude, notamment retrait de argument-hint ; ne pas comparer naïvement les hashes au source canonique.

`make doctor` hors sandbox : un échec critique, `claude CLI not found`. GitHub accessible.
Avertissements : gh non authentifié, endpoint Anthropic inaccessible. Le connecteur GitHub a permis les lectures distantes.
Dans le sandbox, un deuxième échec réseau GitHub était observé ; ce diagnostic disparaît hors sandbox.
Le doctor ne prouve pas la découverte des skills Codex.
Aucun test de fonctionnalité ni de non-régression exécuté. Aucun runtime Claude ou Kilo validé.

## Pourquoi une nouvelle session

Le catalogue de skills fourni à cette session ne contient aucune capacité AIDD.
Présence des fichiers et statut installé ne prouvent pas une invocation effective depuis VS Code.
Le script `scripts/dev-sync.sh` termine par : « Done. Restart Claude/Codex; OpenCode discovers the refreshed skills without a restart. »
La [documentation officielle des plugins](https://learn.chatgpt.com/docs/plugins) prescrit une nouvelle session après installation.
Les disponibilités des marketplaces locales varient selon les surfaces : [documentation d'empaquetage](https://developers.openai.com/plugins/build/plugins).
Aucune syntaxe d'invocation VS Code n'a été supposée ou testée. Les noms canoniques AIDD identifient les capacités, sans établir leur syntaxe d'invocation Codex.

## État de l'issue et évolutions connexes

Issue #914 ouverte, dernière modification reçue : 2026-10-10T09:45:34Z. Corps intégral et unique commentaire conservés dans `issue-914.md`.
Le commentaire de waewoo annonce la contribution ; aucun changement de périmètre dans ce commentaire.
#744 fermée completed ; #868 ouverte et strictement hors périmètre (distribution flat).
Recherche PR « Kilo » et « 914 » : pas de PR dédiée concurrente trouvée ; recherche limitée à ces termes.
[PR #979](https://github.com/ai-driven-dev/framework/pull/979) chevauche le générateur de règles, exclut explicitement Kilo et change les contrats Codex/OpenCode vers AGENTS.md. Vérifier son statut et sa base avant de planifier la modification.
[PR #971](https://github.com/ai-driven-dev/framework/pull/971) intégrée dans la base : bridge Kilo avec couverture élargie des événements.

## Écarts observés et risques à instruire

- Onboarding : `plugins/aidd-context/skills/00-onboard/references/state/detection.md` ne mentionne pas Kilo.
- Mémoire : `02-project-memory/references/tools.md` ne mentionne pas Kilo. Le contrat existant protège le contenu utilisateur et partage AGENTS.md.
- `plugins/aidd-context/hooks/update_memory.js` possède un ensemble dédupliqué de cibles mais TOOL_FILES ne contient pas kilo. Réutiliser ce mécanisme, vérifier ses tests.
- Le chemin `02-project-init` cité dans #914 a disparu de next. Les capacités actuelles incluent `01-bootstrap` et `02-project-memory`. Résoudre cette divergence au niveau des responsabilités.
- Générateurs 04 à 08 : les références de détection, chemins ou formats lues omettent Kilo. Lecture exhaustive des actions et assets encore à faire.
- Profil CLI Kilo déjà existant : ne pas redévelopper #744.
- `kilo-paths.ts` refuse les configurations JSON/JSONC doubles. Ce refus CLI n'est pas le contrat runtime requis par #914 : ne pas le réutiliser aveuglément.
- `kilo-hooks-bridge.ts` traite désormais SessionStart, Stop et PostToolUse. #914 restreint la référence de bridge à session.created : signaler cette évolution sans élargir le scope.
- Ne pas dupliquer un générateur ni créer de liens inter-skills incompatibles avec les distributions flat. Responsabilité de génération : aidd-context.
- Préserver les sources Claude canoniques et les autres sorties. Les règles Codex/OpenCode présentes dans la base sont précisément une surface susceptible de changer via #979.
- Édition JSONC, instructions dupliquées, sélection multi-config, idempotence et absence d'écritures partielles exigent des preuves observables, pas une simple table de valeurs.
- Sources Kilo de #914 encore à relire dans leur version courante. La date contractuelle est 2026-09-25 ; documenter séparément toute revérification et divergence.

## Reprise demandée

1. Ouvrir une nouvelle session Codex dans le workspace VS Code `/home/coder/project`. Si les skills ne sont pas visibles, recharger la fenêtre VS Code puis revérifier.
2. Lire ce document, `user-request.md` et `issue-914.md`. Vérifier git status sans recréer la branche ou les remotes.
3. Vérifier que les capacités AIDD sont réellement présentes dans le catalogue de la session et invocables via le mécanisme natif. Si absentes, diagnostiquer avec les mécanismes officiellement supportés avant de planifier.
4. Les contrats source de plan et challenge ont été lus seulement pour établir leur contenu, sans invoquer ni prétendre exécuter les skills.
5. Utiliser effectivement la capacité de planification installée. Son contrat actuel : gather, explore, skip wireframe (pas de UI), plan ; plan.md et phase-n.md dans ce dossier ; backlog-link.json créé par l'action de plan. Ne pas émettre step-end avant accomplissement.
6. Onboarding facultatif ; mémoire déjà présente, ne pas la réinitialiser sans nécessité établie.
7. Revalider les sources Kilo, analyser tous les générateurs et les tests, puis produire une matrice couvrant les seize critères officiels, les fichiers, tests, preuves attendues et risques Claude/Codex/OpenCode/autres.
8. La capacité challenge accepte un plan comme travail et les exigences comme référence ; elle est applicable après production du plan et découverte effective.
9. Présenter plan et matrice, puis attendre la validation explicite de l'utilisateur. Aucun développement avant celle-ci.

Message à copier dans la nouvelle session :

> Reprends #914 depuis aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/resume.md. Vérifie la découverte effective des skills AIDD installés, puis utilise leur workflow pour produire et challenger le plan et la matrice complète. Arrête-toi à la validation du plan, sans implémenter, commit, push ni PR.
