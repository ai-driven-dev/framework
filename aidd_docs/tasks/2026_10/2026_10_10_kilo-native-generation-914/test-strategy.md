# Stratégie de validation

## Séparer ce qui est prouvé

1. Contrat de source : assertions structurelles et références, avec mutations ciblées qui rendent la garde rouge. Nécessaire, insuffisant pour un skill interprété.
2. Artefact : exécuter le vrai writer/hook dans des projets temporaires, inspecter bytes, YAML/TOML/JSONC, arbres et hashes. Pas de mocks de filesystem pour les preuves de conservation.
3. Génération comportementale : Codex principal charge les skills effectivement livrés, exécute leurs actions sur fixtures avec réponses utilisateur enregistrées. La sortie attendue n'est jamais copiée manuellement comme résultat du skill. Couvrir toutes les cibles, dont Claude sans Anthropic. Séparer intervention nécessaire et sélection implicite interdite.
4. Loader Kilo : vrai binaire consomme ces sorties ; observations du catalogue/config résolue et requêtes de contexte. Inférence locale déterministe réutilisée de #971 pour rendre visibles les payloads. C'est un runtime réel avec backend contrôlé, pas une preuve de raisonnement d'un modèle externe.
5. Usage Kilo : modèle gratuit effectivement accessible, invocation des skills/agents/commands et tâches nécessitant règles/mémoire. Traces tool/command et résultats contrôlés, pas réponse sentinelle seulement. Aucun paiement ou fallback payant.

## Fixtures et oracles

Suite temporaire commune : .kilo seule ; chacun des quatre fichiers config seul ; .kilocode seule ; opencode.json et opencode.jsonc seuls ; mélange Kilo/Claude/Codex/OpenCode/Cursor/Copilot ; projet sans config. Frontières de root, noms avec échappements, ESM, LF/CRLF, espaces/tabs, Unicode.

Configs : zéro fichier, unique, plusieurs avec propriétaire unique de l'entrée exacte, plusieurs sans propriétaire, propriétaires multiples, sélection explicitement refusée/annulée. L'existence du chemin exact .kilo/rules/category/slug.md dans un instructions valide identifie un candidat propriétaire ; glob voisin, commentaire ou chaîne JSON imbriquée ne le font pas. Plusieurs propriétaires restent ambigus. Ne pas ajouter de champ privé non documenté au config pour l'ownership.

Édition : instructions absent, tableau vide ou rempli, répétitions préexistantes y compris de l'entrée AIDD, espaces/commentaires entre tokens, trailing commas, URL avec //, chaînes contenant accolades, clés échappées, commentaires bloc. Insertion minimale seulement ; aucun JSON.parse/JSON.stringify global. Conserver tous doublons et ordre existants ; si entrée exacte déjà présente, aucune insertion. Invalides : JSONC non fermé, instructions scalaire, éléments non strings, clés instructions dupliquées, UTF-8 invalide, collision de fichier utilisateur, lien symbolique/ancêtre hors root, config choisie disparue/modifiée.

Oracles : carte complète chemin -> hash avant/après, octets hors plage éditée identiques, parsing indépendant après édition, résultat runtime cohérent avec la config sélectionnée, second passage bytes et mtime inchangés. Erreur/annulation : aucun nouvel artefact, aucune config/règle/source modifiée ; pas de temporaires restants. Pour les erreurs multi-destinations, invalider le dernier candidat pour détecter une validation tardive. Pour publication règle/config, injecter échec de staging/rename avec restauration observable ; un renommage par fichier ne suffit pas pour promettre zéro écriture partielle. Concurrence/crash machine hors garantie générale : détecter changement entre préflight et commit, refuser avant publication ; documenter toute limite résiduelle, ne pas cocher AC14 si l'erreur réellement testée laisse une écriture partielle.

## Claude hors ligne et comportement

Réutiliser scripts/__tests__/update-memory.test.js et fixtures Claude du CLI. Renforcer par vrais sous-processus ; CLAUDE.md garde ses imports @ et son contenu hors bloc. Règles .claude/rules avec paths seulement si scope ; skills .claude/skills avec frontmatter canonique ; agents .claude/agents avec name/description/options ; commandes .claude/commands avec champs acceptés ; hooks déclaratifs conservés pour Claude et dédupliqués sur relance, sans effacer les hooks utilisateur.

Tester sorties génération Claude par Codex et scripts déterministes disponibles, ainsi que snapshots CLI de distribution : ces preuves ont des scopes différents. Parsing des formats, chemins, contenu complet, idempotence, ownership, refus sans mutation. Le validateur installé `claude plugin validate` peut vérifier les packages sans demander une inférence ; `scripts/check-claude-accepts-build.cjs` lit Validation passed/failed, pas seulement le code de sortie. Il ne valide pas le comportement LLM de tous les générateurs.

Indisponible : claude -p avec modèle Claude authentifié, y compris le runner actuel scripts/skill-eval.mjs. CONTRIBUTING demande des tests dans Claude et un autre outil ; validateur + artefacts ne remplacent pas ce parcours authentifié. À obtenir d'un mainteneur/environnement disposant déjà de l'accès avant une affirmation de validation runtime Claude complète, sans exiger un abonnement de l'utilisateur. Aucun des 16 critères n'exige lui-même une inférence Claude ; AC15 vise Kilo. Limite supplémentaire de non-régression, pas excuse pour omettre un critère Kilo.

## Codex, OpenCode et autres cibles

Codex : génération réelle des cibles, découverte de skills traduits, TOML agents correctement échappé, instructions issues de la publication active de la base #979 choisie, conservation AGENTS.md et distinction des blocs. Captures des entrées host prouvent chargement, pas enforcement sémantique universel.

OpenCode absent ici : fixtures et suites CLI existantes, plugin opencode tests, golden snapshots. Aucun nouvel outil installé pour le plan. Runtime version(s) supportée(s) à exécuter dans environnement déjà équipé/CI ; OpenCode V1/V2 ne sont pas interchangeables, figer les versions. Si manquant, publier ce manque au rapport final ; pas de revendication runtime.

Cursor/Copilot : garder formats règle/agent/command/hook réellement supportés, sorties skip explicites quand unsupported, mémoire Copilot liens ../ ; matrices mixtes vérifient que Kilo n'altère pas les sorties non sélectionnées. Pas d'exécution IDE prétendue.

## Preuve runtime Kilo par artefact

- Mémoire : AGENTS.md chargé automatiquement ; demander une tâche nécessitant un fichier mémoire lié et vérifier sa lecture effective. Un lien n'est pas un import. Respecter l'approbation de modification AGENTS.md par le host.
- Règle : config résolue contient le chemin exact ; contexte envoyé contient un marqueur de corps unique ; négatif sans instructions ne charge pas ce fichier ; tâche applique la règle avec modèle gratuit.
- Skill : kilo debug skill expose nom/description/chemin exact ; usage réel trace le chargement du SKILL.md et de son action, plus résultat ; portable choisi explicitement une seule fois.
- Agent : liste/debug expose nom issu du fichier et options ; invocation via tâche/subagent supportée produit un résultat et prouve le bon corps chargé. Ne pas confondre invocation primary et subagent.
- Commande : catalogue du runtime et invocation kilo run --command avec modèle gratuit ; observer expansion et corps de .kilo/commands. Aucun champ Claude non supporté.
- Hooks : guidance #914 n'émet pas de plugin ; pas de test d'un plugin inventé. Vérifier absence d'écriture, refus précis pour event non prouvé, et réutiliser le bridge existant pour session.created si invoqué dans une fixture séparée.

Linux local 7.8.8 d'abord. Utiliser la CI existante Windows/macOS selon matrice supportée du projet ; publier OS/version et résultats séparés. Windows Kilo runtime non prouvé par les preuves #971. Les critères runtime de plateforme restent ouverts jusqu'à exécution sur ces plateformes ; un skip n'est jamais pass. Conserver commandes, stdout/stderr expurgés, payloads sans secrets, hashes d'artefacts générés et négatifs, versions et nettoyage.

## Commandes prévues après approbation

```sh
node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'
pnpm test:changed
pnpm --dir cli test
pnpm --dir cli test:e2e:kilo
node scripts/check-claude-accepts-build.cjs
make check
```

Le CLI doit être construit pour les checks qui le consomment ; vérifier les prérequis existants sans réinstaller aveuglément. Ajouter une commande documentée opt-in au harness comportemental et au runtime natif phase 6, après lecture des APIs/flags exposés. Pas de nom de commande future présenté comme déjà disponible. Les tests Kilo existants peuvent dépendre d'un serveur local et d'une élévation du sandbox ; ne pas masquer une erreur d'environnement.

`make check` régénère et stage certains docs : le lancer seulement pendant l'implémentation autorisée, inspecter ses deltas et ne jamais commit/push automatiquement. Gates CLI lint/typecheck/architecture/knip et mutations ciblées si CLI/tests/scripts impactés ; pas de hausse de seuil. Test rouge avant implémentation pour chaque nouveau comportement ; cas négatif doit échouer quand l'invariant est volontairement cassé. Tests/docus livrés dans chaque phase, phase 6 consolide seulement les preuves de bout en bout.
