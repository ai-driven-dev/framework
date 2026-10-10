# Exploration AIDD

Action `02-explore` exécutée après gather ; action wireframe omise : aucune UI.

## Découverte et exécution des capacités

Le catalogue natif fourni à cette nouvelle session contient les neuf plugins AIDD et les entrées `aidd-dev:01-plan` et `aidd-refine:02-challenge`. Le host donne leurs chemins installés. Le caller charge leurs SKILL.md, leurs actions, templates et références depuis ces chemins et exécute leurs procédures dans son contexte : c'est le modèle d'exécution des skills décrit dans `docs/ARCHITECTURE.md`, pas une commande CLI inventée. Aucun outil de dispatch distinct n'est exposé ici. Aucun prétendu slash-command VS Code n'a été testé. Les artefacts gather/explore/plan/phases et challenge sont les résultats de ces capacités, et non la preuve d'une exécution de générateur Kilo.

Plan chargé depuis `/home/coder/.codex/plugins/cache/aidd-framework/aidd-dev/2.6.0/skills/01-plan/` ; challenge depuis `/home/coder/.codex/plugins/cache/aidd-framework/aidd-refine/3.1.0/skills/02-challenge/`. Actions lues avant exécution. Aucun workflow `02-implement` invoqué. Exploration auxiliaire en lecture seule autorisée par AGENTS.md ; aucune délégation d'exécution du plan.

## État observé

`git status --short --branch` : branche `feat/kilo-native-generation-914`, seul dossier de tâche non suivi. HEAD = upstream/next local = `41e91691b5837a8c27475d0115725131bb53bf41`. Aucun fetch ni changement de branche. #971 merge `12777d03808cee29f611e18d3816ae62ebc5c969` est ancêtre de HEAD (merge-base code 0). Les métadonnées GitHub actuelles sont conservées dans `remote-state.json`.

Kilo 7.8.8 confirmé par --help ; Claude 2.1.296 par --version. OpenCode absent du PATH. Les outils n'ont pas été réinstallés. Le nouveau résultat doctor annoncé par l'utilisateur n'a pas été réexécuté et n'est pas présenté comme notre observation. Le lancement Kilo dans le sandbox échoue EROFS sur son état utilisateur ; les diagnostics et la sonde gratuite passent hors sandbox après élévation. Aucune configuration ni credential modifié intentionnellement ; Kilo peut créer son état/cache/session normal.

## Projection et responsabilité

Les arbres exacts sont répartis dans phase-1 à phase-6 ; leur union définit les modifications et créations. Aucune suppression prévue. Génération dans aidd-context ; scripts déterministes embarqués dans le skill propriétaire, tests hors arbre livré dans scripts/__tests__. CLI : contrat conservé, ajouts de tests runtime uniquement. Pas de modification des profils, archives flat ou traducteurs pour redévelopper #744/#868. Documentation publique minimale dans README du plugin ; connaissances de reprise dans ce dossier, pas de réinitialisation de mémoire projet.

## Constat de code et faisabilité

- `00-onboard/references/state/detection.md` et `02-project-memory/references/tools.md` omettent Kilo. `01-bootstrap` ne fait que concevoir INSTALL.md : aucun changement nécessaire. `02-project-init` cité par le ticket est obsolète ; sa responsabilité pertinente est dans `02-project-memory`.
- `update_memory.js` connaît trois fichiers cibles et déduplique via Set ; ajouter le sélecteur kilo réutilise AGENTS.md. Sa boucle écrit avant d'apprendre qu'un autre bloc est invalide : prévoir preflight pour la synchronisation explicitement demandée, sans transformer tout le hook automatique.
- Générateurs 04 à 08 : actions, assets et références analysés. Les scaffolds restent Claude ; rendu Kilo seulement au niveau cible. Validation agents actuelle exige name partout, à scoper pour le nom issu du fichier Kilo. Hooks : déduplication actuelle insuffisante à la relance et instruction de rabattre un événement absent dangereuse pour Kilo.
- `05-rule-generate` écrit directement avec contrats anciens ; #979 propose un writer autonome encore absent de HEAD. Voir overlap-979.md pour le choix d'intégration.
- `kilo-paths.ts` et ses tests imposent un refus dual-config propre au CLI : ne pas importer ce contrat pour les générateurs. `kernel/reading/jsonc.ts` enlève les commentaires sans inverse ; ce n'est pas un éditeur préservant les octets.
- Tests hook mémoire existants : vrais sous-processus temporaires ; à renforcer. `scripts/skill-eval/cases.json` contient six cas mémoire, mais le runner nécessite claude -p authentifié. Aucun cas actuel 04/06/07/08. Fixtures framework-real anciennes : fixtures de traduction, pas couverture des générateurs actuels.
- `cli/tests/e2e/kilo-runtime.e2e.test.ts` utilise le vrai runtime avec serveur d'inférence déterministe local, couvre mémoire/hooks/read. Réutiliser isolation et nettoyage ; sa traduction flat n'est pas la génération native #914. Les nouveaux tests consomment les sorties effectives des skills.
- Le test CLI Kilo nommé préservation JSONC compare surtout du JSON parsé, pas les commentaires. Il reste une garde CLI, pas une preuve du critère 8.

## Règles retenues

`docs/ARCHITECTURE.md` : séparation production de connaissances / CLI de distribution, assets canoniques, tests hors hooks, aucun lien relatif entre skills. Chaque skill porte sa référence Kilo pertinente avec URL/date ; ne pas créer de référence transversale non portable. `CONTRIBUTING.md` : Claude syntax only pour sources, tests dans Claude et un autre outil ; limite runtime Claude déclarée dans test-strategy.md. `coding-assertions.md` : test rouge avant code, mutation ciblée des gardes, lire après édition. `testing.md` : wrapper obligatoire pour node --test.

## Risques et vérifications

Sources officielles et dates détaillées dans official-sources.md ; chemins/contrats vérifiés à nouveau, sans prétendre avoir observé nous-mêmes le 25 septembre. Risques prioritaires : concurrence #979, JSONC sans perte et transaction multi-fichiers, validations génériques contradictoires, preuves LLM non déterministes, différences plateforme, visibilité du contenu lié par AGENTS.md. Aucun test de fonctionnalité #914 exécuté à cette étape.
