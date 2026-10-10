# Handoff Codex — Contribution AIDD #914

## Mission

Développer l'issue officielle :

https://github.com/ai-driven-dev/framework/issues/914

**feat(aidd-context): add Kilo-native generation targets**

Objectif : permettre à AIDD de détecter les projets Kilo Code et de générer correctement leurs artefacts natifs : règles, skills, agents, workflows, Project Memory et indications de hooks.

**Impératif : utiliser le framework AIDD lui-même pour planifier, développer, tester et reviewer cette contribution.**

La fonctionnalité doit être entièrement conforme aux critères d'acceptation de l'issue et ne doit introduire aucune régression sur Claude Code ni sur les autres outils déjà supportés.

## 1. Environnement existant

Le dépôt est déjà cloné dans :

`~/project`

La branche actuellement ouverte est `main`.

Les remotes Git sont déjà configurés :

- `origin` : `git@github.com:waewoo/framework.git`
- `upstream` : `git@github.com:ai-driven-dev/framework.git`

Ne recrée pas ces remotes et ne reclone pas le dépôt.

AIDD n'est pas encore installé dans l'environnement de développement Codex. Son installation et sa vérification font donc partie de cette mission.

L'IDE utilisé est VS Code avec l'extension Codex, dans un workspace distant Coder.

## 2. Préparer Git en sécurité

Avant toute opération :

1. Vérifier `git status`, la branche courante et les remotes.
2. Vérifier les éventuelles modifications non commitées.
3. Exécuter `git fetch upstream`.
4. Vérifier la présence de `upstream/next`.
5. Créer une branche dédiée issue de `upstream/next` :

   `feat/kilo-native-generation-914`

6. Ne jamais écraser les modifications locales.
7. Ne jamais effectuer de `reset --hard`, de nettoyage destructif ou de push forcé.
8. Vérifier l'état actuel de l'issue #914 et rechercher d'éventuelles PR concurrentes.

La future PR devra cibler `ai-driven-dev/framework:next`, jamais `main`.

## 3. Installer AIDD dans l'environnement Codex

Cette étape est obligatoire avant la planification.

Lire en priorité :

- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- Les instructions d'installation et de compatibilité Codex.
- Les instructions des plugins et skills AIDD.

### Préparer les prérequis

Vérifier les versions et la disponibilité de :

- Node.js 22.12+
- pnpm
- jq
- Python 3
- pipx
- make
- Git

Installer uniquement les dépendances manquantes en respectant le mécanisme recommandé par le dépôt.

### Installer le framework

Utiliser la procédure officielle documentée dans le dépôt.

La commande de référence pour préparer l'environnement contributeur est :

`make setup`

Vérifier son comportement actuel avant exécution, notamment les éventuelles modifications des configurations utilisateur et les installations dans Claude Code ou Codex.

Utiliser ensuite :

`make doctor`

### Vérifier les skills dans Codex

Ne considère pas l'installation comme réussie uniquement parce que `make setup` termine sans erreur.

Vérifier concrètement :

- Où Codex découvre les skills AIDD.
- Quels plugins et skills sont disponibles.
- Si les skills nécessaires peuvent réellement être invoqués depuis la session VS Code.
- Si les chemins et dépendances sont correctement résolus.
- Si un redémarrage de la session Codex est nécessaire.

Ne pas confondre présence des fichiers et découverte effective par Codex.

Ne pas inventer de syntaxe d'invocation.

Si un redémarrage est nécessaire, fournir un état de reprise précis avec les instructions permettant de reprendre le travail dans une nouvelle session.

En cas d'incompatibilité, documenter le problème et proposer le mécanisme officiellement supporté avant de poursuivre.

## 4. Charger et utiliser AIDD

Utiliser effectivement les capacités AIDD disponibles.

Workflow visé :

1. `aidd-context:00-onboard`, si pertinent.
2. `aidd-context:02-project-memory`, seulement si une initialisation ou actualisation est nécessaire.
3. `aidd-dev:01-plan`.
4. `aidd-refine:02-challenge`, lorsque ses préconditions sont satisfaites.
5. `aidd-dev:02-implement`.
6. `aidd-dev:06-test`.
7. `aidd-dev:03-assert`.
8. `aidd-dev:05-review`.
9. Les capacités AIDD de gestion des commits et PR, lorsque leur utilisation est appropriée.

Vérifier les noms exacts et les contrats des skills dans la version installée.

Ne pas improviser un workflow parallèle si les capacités AIDD existent.

Respecter la séparation des responsabilités entre planification, implémentation, tests, assertions et review.

## 5. Analyser intégralement l'issue #914

Lire :

https://github.com/ai-driven-dev/framework/issues/914

Utiliser sa version courante, incluant les commentaires et éventuelles modifications de périmètre.

Examiner les implémentations existantes, en particulier :

- `cli/src/contexts/tools/domain/profiles/kilo/profile.ts`
- `cli/src/contexts/tools/domain/profiles/kilo/kilo-paths.ts`
- `cli/src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts`
- Les générateurs du plugin `aidd-context`.
- Les tests, fixtures et utilitaires existants.
- Les mécanismes équivalents pour Claude Code et OpenCode.

Vérifier également les issues liées :

- #744 : support CLI Kilo livré.
- #868 : distribution des règles Kilo en mode flat, hors périmètre.
- Les éventuelles évolutions récentes affectant les mêmes générateurs.

Ne pas développer de fonctionnalité déjà implémentée.

## 6. Contraintes architecturales impératives

Le framework AIDD utilise les formats sources canoniques Claude Code pour ses skills, agents et règles.

**L'ajout de Kilo ne doit pas modifier ni dégrader ces contrats existants.**

Principes :

- Préserver Claude Code comme cible pleinement fonctionnelle.
- Préserver les autres cibles supportées, notamment Codex et OpenCode.
- Réutiliser les mécanismes existants.
- Éviter de dupliquer un générateur complet pour Kilo.
- Isoler les adaptations propres aux outils aux bons niveaux d'abstraction.
- Ne pas introduire de dépendance injustifiée entre plugins.
- Respecter les frontières définies par `docs/ARCHITECTURE.md`.
- Ne pas modifier le mécanisme de distribution flat relevant de #868.

Ne pas introduire de refactoring global sans justification directement liée à #914.

## 7. Critères d'acceptation à couvrir

Construire une matrice de traçabilité entre chaque critère de l'issue, les fichiers modifiés, les tests et les preuves de validation.

### A. Détection de Kilo

Prendre en charge les signaux documentés :

- `.kilo/`
- `.kilocode/` comme signal historique uniquement
- `kilo.json` et `kilo.jsonc` à la racine
- `.kilo/kilo.json` et `.kilo/kilo.jsonc`

Ne pas détecter Kilo sur la seule présence de `opencode.json[c]`.

Générer les nouveaux artefacts dans `.kilo/`, jamais dans `.kilocode/`.

### B. Project Memory

Utiliser `AGENTS.md` à la racine comme surface principale de Project Memory pour Kilo.

Préserver les contenus écrits par l'utilisateur.

Modifier uniquement les sections réellement contrôlées par AIDD.

Éviter les duplications lorsque plusieurs outils partagent le même fichier.

### C. Rules

Produire les règles sous les chemins canoniques `.kilo/rules/`.

Référencer explicitement les fichiers dans le tableau `instructions` de la configuration Kilo.

Ne pas considérer le répertoire des règles comme automatiquement découvert.

Préserver l'ordre des instructions.

### D. Configuration JSON / JSONC

Respecter les règles de sélection de fichier définies dans l'issue.

En particulier :

- Créer `.kilo/kilo.jsonc` lorsqu'aucune configuration projet n'existe.
- Modifier l'unique configuration existante lorsqu'elle est non ambiguë.
- Réutiliser le propriétaire actuel d'une entrée AIDD lorsqu'il peut être identifié.
- En présence de plusieurs configurations ambiguës, demander une sélection explicite.
- Respecter la précédence documentée de Kilo.
- Préserver les instructions existantes, leur ordre, leurs doublons, les commentaires JSONC, les virgules finales et les autres éléments de formatage.
- Garantir l'idempotence.
- Ne pas effectuer d'écriture partielle lorsqu'une modification sûre est impossible.

Ne pas appliquer aveuglément au runtime Kilo les restrictions spécifiques du CLI AIDD.

### E. Skills

Générer des skills conformes au format Agent Skills.

Pour Kilo uniquement, utiliser `.kilo/skills/`.

N'utiliser `.agents/skills/` que si l'utilisateur choisit explicitement une cible partagée portable.

Ne jamais générer deux copies du même skill.

### F. Agents

Utiliser les emplacements natifs `.kilo/agents/`.

Respecter le contrat de frontmatter documenté.

Préserver les champs optionnels officiellement supportés lorsqu'ils sont demandés.

### G. Workflows

Générer les commandes Markdown dans `.kilo/commands/`.

N'utiliser que les propriétés de frontmatter effectivement supportées par Kilo.

### H. Hooks

Ne jamais produire de hooks déclaratifs Claude pour Kilo.

Utiliser les contrats documentés des plugins JavaScript/TypeScript Kilo.

Ne citer un équivalent d'événement ou de hook que lorsqu'il est officiellement vérifié.

Ne pas étendre le périmètre à une conversion générique des hooks.

### I. Compatibilité et traçabilité

Chaque comportement spécifique à Kilo doit reposer sur un contrat vérifié.

Respecter les sources documentaires mentionnées dans l'issue et leur date de vérification.

Vérifier les éventuels changements récents et signaler toute divergence avec l'issue plutôt que modifier silencieusement son contrat.

## 8. Planification avec AIDD

Utiliser `aidd-dev:01-plan`.

Produire un plan découpé en tâches fonctionnelles cohérentes, incluant leurs tests et les mises à jour documentaires associées.

Ne pas découper artificiellement le code, les tests et la documentation d'une même fonctionnalité en commits séparés.

Prévoir des jalons de validation intermédiaires.

La matrice d'acceptation doit couvrir l'intégralité de #914.

Examiner explicitement les risques de régression sur :

- Claude Code.
- Codex.
- OpenCode.
- Les autres outils supportés.
- Les formats sources canoniques.
- L'onboarding AIDD.
- Les générateurs existants.
- Les configurations multi-outils.

Utiliser `aidd-refine:02-challenge` pour challenger le plan si applicable.

Présenter le plan avant implémentation.

## 9. Implémentation

Après validation du plan, utiliser `aidd-dev:02-implement`.

Respecter les phases prévues, le périmètre de l'issue et les conventions du dépôt.

Pour chaque tâche :

1. Implémenter le comportement.
2. Ajouter ou adapter les tests pertinents.
3. Mettre à jour la documentation nécessaire.
4. Exécuter les validations adaptées.
5. Corriger les problèmes identifiés.
6. Conserver des preuves vérifiables du résultat.

Aucun changement ne doit introduire une duplication injustifiée ni dégrader le fonctionnement des autres outils.

Ne pas commit ni push sans autorisation.

## 10. Tests et non-régression obligatoires

Utiliser les contrats AIDD de tests et d'assertions.

Construire des tests représentatifs pour chaque critère de #914.

### Tests Kilo

- Détection des différents signaux.
- Absence de faux positifs OpenCode.
- Génération de Project Memory.
- Préservation du contenu `AGENTS.md`.
- Génération des règles et référencement dans `instructions`.
- Génération des skills.
- Génération des agents.
- Génération des workflows.
- Comportement des hooks.
- Gestion des configurations multiples.
- Préservation JSONC.
- Idempotence.
- Échecs sans écriture partielle.
- Découverte effective des artefacts dans Kilo.

### Tests de non-régression

Vérifier explicitement que les comportements existants des générateurs restent inchangés pour Claude Code.

Conserver les tests existants et en ajouter lorsque les chemins modifiés peuvent affecter Claude.

Vérifier également les contrats pertinents de Codex et OpenCode.

Éviter de créer des tests se contentant de reproduire des valeurs configurées dans les mocks.

Tester les comportements observables, avec des fixtures réalistes.

### Validation runtime

Ne pas considérer les tests unitaires comme une preuve d'intégration runtime.

Exécuter les scénarios de découverte d'artefacts avec Kilo lorsqu'un runtime compatible est disponible.

Suivre également les exigences de `CONTRIBUTING.md`, dont les validations locales et les tests avec Claude et un autre outil.

Si Claude ou Kilo ne sont pas disponibles dans l'environnement, identifier les validations manquantes et ne pas les présenter comme réussies.

Les changements impliquant des configurations ou fichiers partagés doivent faire l'objet de tests de préservation des données utilisateur.

### Commandes projet

Découvrir les commandes applicables dans le dépôt.

Vérifier notamment :

- `make check`
- `make reload`
- Les tests spécifiques au périmètre modifié.
- Les éventuelles validations additionnelles définies par le workflow contributeur.

Ne pas inventer de résultat de test.

## 11. Review avec AIDD

Utiliser `aidd-dev:05-review`.

La review doit analyser :

- Le respect de chaque critère d'acceptation.
- La qualité de l'architecture.
- La préservation des comportements Claude Code.
- La non-régression Codex / OpenCode.
- Les risques de perte de configuration utilisateur.
- L'idempotence.
- La qualité et l'efficacité des tests.
- Les preuves de validation runtime.
- Les écarts entre l'implémentation et les spécifications de #914.
- L'absence de changements relevant de #868.

Corriger les problèmes, puis relancer les validations concernées.

## 12. Stratégie Git et Pull Request

La contribution doit cibler `upstream/next`.

Respecter les conventions de commits du projet.

Conserver des unités de travail cohérentes, comprenant le comportement, ses tests et sa documentation associée.

### Stratégie de PR

Ne pas ouvrir de PR immédiatement après la création de la branche.

Séquence recommandée :

1. Plan validé.
2. Première tranche fonctionnelle implémentée et testée.
3. Proposition de commits cohérents.
4. Après mon autorisation explicite : commit et push vers mon fork `waewoo/framework`.
5. Après mon autorisation explicite : création d'une Draft PR ciblant `ai-driven-dev/framework:next`.
6. Poursuite des développements avec retours et tests.
7. Review AIDD complète et validation des critères d'acceptation.
8. Après mon autorisation : passage de la PR en Ready for review.

Ne jamais ouvrir une PR sur la branche `main`.

Utiliser le template de PR officiel.

Référencer #914 et documenter les tests réellement exécutés.

Évaluer si le volume de #914 justifie plusieurs PR cohérentes. Ne modifier la stratégie de découpage qu'après validation.

## 13. Règles d'autonomie

Tu peux :

- Lire les fichiers et la documentation.
- Installer les prérequis nécessaires au développement, après vérification de leur portée.
- Exécuter les commandes de diagnostic et de test.
- Préparer une branche dédiée.
- Réaliser les modifications autorisées après validation du plan.

Tu ne peux pas, sans mon accord explicite :

- Écraser des modifications locales.
- Modifier durablement des paramètres utilisateur sans nécessité validée.
- Commit.
- Push.
- Créer ou modifier une PR distante.
- Modifier le périmètre officiel de l'issue.

Si le contexte de la conversation est compacté ou si une nouvelle session est nécessaire, conserver les décisions et l'état du travail dans les artefacts prévus par AIDD.

## 14. Première étape à exécuter maintenant

Commence uniquement par :

1. Vérifier mon environnement Git et les modifications locales.
2. Préparer la branche de contribution depuis `upstream/next`.
3. Installer et vérifier AIDD dans Codex.
4. Lire les instructions du dépôt.
5. Lire intégralement l'issue #914.
6. Identifier les écarts actuels et les risques de régression Claude Code.
7. Utiliser `aidd-dev:01-plan` pour produire le plan.
8. Challenger le plan lorsque le workflow AIDD le prévoit.
9. Présenter la matrice de couverture des critères d'acceptation et le plan détaillé.

**Arrête-toi à la validation du plan. N'entame pas encore l'implémentation, ne commit pas et ne crée pas de PR.**