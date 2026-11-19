# Contexte court et délégation : résultats et limites

**Constat au 18 novembre 2026.** Les essais du framework n'ont pas démontré de réduction reproductible des tokens de bout en bout, à qualité égale, sur des tâches indépendantes. Certains essais isolés ont réduit ce total. Le hook expérimental et l'allègement automatique des agents ont été retirés de la [PR framework #1144](https://github.com/ai-driven-dev/framework/pull/1144), qui conserve la télémétrie.

## Pourquoi le résultat de Spotify n'est pas directement comparable

L'[article de Spotify sur Portal et Shunt](https://engineering.atspotify.com/2026/9/portal-by-spotify-cut-my-claude-code-token-usage-by-90) annonce environ **90 % de réduction des tokens consommés par Claude pour les lectures**, parmi quatre scénarios évalués dans un monorepo Java. Il compare le contexte Claude nécessaire pour lire les fichiers à celui nécessaire pour lire le résumé. Il ne publie pas un total comparable incluant tous les tokens du worker. Cela ne prouve ni que leur système économise 90 % au total, ni qu'il n'économise rien au total.

À la [révision publique `aa252eb`](https://github.com/spotify/portal-ai-plugins/tree/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt) examinée :

- Le lecteur reçoit une question et les fichiers explicitement listés, puis invoque un mode Portal éphémère. L'exemple utilise Gemini 2.5 Flash avec une température de 0,2. Une invocation ne prouve pas le nombre de requêtes internes au modèle. [Script](https://github.com/spotify/portal-ai-plugins/blob/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt/scripts/bulk-read#L36-L53).
- Le générateur reçoit une spécification et un fichier de référence obligatoire ; il peut écrire le résultat sur disque. La [skill demande ensuite de revoir le résultat](https://github.com/spotify/portal-ai-plugins/blob/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt/skills/code-writer/SKILL.md). Aucun hook `Write` n'impose cette délégation.
- Les hooks interceptent `Read` et certaines lectures Bash, avec un seuil configurable de 350 lignes par défaut. Ils laissent notamment passer les `Read` avec `offset` ou `limit` et certaines commandes Bash. Ce routage n'est pas une barrière de confinement générale. [Hooks](https://github.com/spotify/portal-ai-plugins/blob/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt/hooks/hooks.json), [lecture](https://github.com/spotify/portal-ai-plugins/blob/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt/hooks/check-file-size), [Bash](https://github.com/spotify/portal-ai-plugins/blob/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt/hooks/check-bash-read).
- Le [benchmark public consulté](https://github.com/spotify/portal-ai-plugins/blob/aa252eb21df5bbf32b0beb45f84a2c03341ccad8/plugins/shunt/evals/run.sh#L139-L203) estime les tokens par caractères divisés par quatre et ne compte pas ceux du worker. Sa lecture ignore les échecs et ne vérifie pas la justesse ; son écriture fixe la valeur déléguée à zéro. Il utilise des fixtures TypeScript : on ne sait pas s'il a produit le chiffre du monorepo Java de l'article.

Spotify limite lui-même la portée : génération prévisible et analyse ciblée, avec lecture directe de l'extrait nécessaire pour modifier le code. L'article rapporte aussi un bug de concurrence manqué par le worker. [Limites décrites](https://engineering.atspotify.com/2026/9/portal-by-spotify-cut-my-claude-code-token-usage-by-90).

## Ce que l'étude NVIDIA démontre

Dans [You don't need long context](https://arxiv.org/html/2611.05306v1), les chercheurs comparent notamment l'historique complet à sa **compaction** et, dans une évaluation distincte, étudient la lecture sélective de fichiers par l'agent lui-même. La compaction crée une nouvelle conversation avec la tâche d'origine et un état résumé ; une variante répète ce cycle après chaque action. Ce n'est pas une démonstration qu'un orchestrateur et un petit sous-agent consomment moins ensemble.

Exemple sur SWE-bench Verified : avec Claude Opus 4.5 et un seuil de compaction de 18 000 tokens, le taux de résolution passe de 70,0 % à 74,8 %. Les tokens agrégés d'entrée nouvelle / entrée en cache / sortie passent de **20 / 420 / 4,4 millions** à **22 / 166,5 / 4,1 millions**, sur les tâches du benchmark. [Tableau 3](https://arxiv.org/html/2611.05306v1#A3.T3.fig1).

Ces résultats dépendent du modèle et du réglage : le même article rapporte que Qwen 3 Coder Next passe de 53,0 % à 3,6 % sur SWE-bench avec la configuration 16 000 / 12 000. [Tableau 9](https://arxiv.org/html/2611.05306v1#A4.T9.fig1). Le gain de débit allant jusqu'à **7×** concerne une mesure d'inférence sur GPU H100, pas une baisse de 7× de notre facture ou du nombre total de tokens. [Mesure de débit](https://arxiv.org/html/2611.05306v1#S2.SS5).

## Nos mesures

Essais des 17 et 18 novembre 2026, principalement Claude Code 2.1.323, parent Sonnet et sous-agent Haiku. Chaque ligne est **une paire**, sauf mention contraire. Les totaux additionnent entrée, sortie, création et lecture de cache pour le parent **et** les agents ; ils ne représentent pas un coût monétaire. La qualité a été vérifiée séparément. Les mesures détaillées sont résumées dans la [PR #1144](https://github.com/ai-driven-dev/framework/pull/1144).

| Tâche et comparaison | Avant | Variante | Résultat et qualité observée |
| --- | ---: | ---: | --- |
| Expliquer `query_source` : lecture directe / hook + explorer | 132 082 | 327 667 | **+148 %** ; réponses jugées correctes pour la question. |
| Corriger `query_source` : direct / délégation | 404 391 | 818 648 | **+102,4 %** ; les deux passent 77 tests. |
| Expliquer `marketplace refresh` : direct / explorer limité à la lecture, hook désactivé | 757 223 | 1 783 340 | **+135,5 %** ; limites des tests omises, contradiction sur `--force` et affirmation sur l’authentification non étayée. |
| Générer des tests : direct / Executor natif, consigne affinée | 278 894 | 420 168 | **+50,7 %** ; tests réussis et huit mutations détectées dans les deux cas. |
| Générer un nouveau fichier : direct / générateur natif limité à `Write` | 280 144 | 527 384 | **+88,3 %** ; les deux suites passent et détectent huit mutations. |
| Explorer déjà invoqué : instructions initiales normales / `omitClaudeMd` | 216 769 | 187 748 | **−13,4 %** ; qualité comparable sur cette question. |
| Autre question déjà déléguée : instructions normales / omission | 1 976 114 | 1 057 881 | **−46,5 %** ; deux erreurs matérielles, donc qualité non équivalente. |
| Générer des tests : direct / prototype séparé affiné sur le cas | 206 087 | 186 005 | **−9,7 %** ; une paire seulement, répétition non valide. |

Deux autres comparaisons à brief identique ont mesuré **−7,5 % et −10,1 %** avec omission, à qualité comparable, sur la même question KPI et un agent temporaire. Elles ne valident pas le résultat sur une tâche indépendante. Pour la ligne à −46,5 %, l'explorer a affirmé à tort qu'un registre Codex était lu dans ce parcours et a garanti un code de sortie `0` malgré une synchronisation ultérieure susceptible d'échouer. Les trajectoires des agents diffèrent : la paire ne prouve pas que l'omission a causé ces erreurs.

Le prototype à −9,7 % avait été adapté après observation du même cas. Sa répétition a été refusée par le classificateur automatique de Claude pour `Destructive or Unwanted Actions` ; aucun worker n'a tourné. Ce résultat ne constitue pas une répétition à zéro token et le refus n'a pas été contourné.

## Cas et mesures à conserver

Les trois essais indépendants ci-dessous ont utilisé le code du commit [`db647c621`](https://github.com/ai-driven-dev/framework/commit/db647c621bc873feef3f71109584a151077b0a7f), avant retrait du POC. Les événements identifient `claude-sonnet-5-5` pour le parent et `claude-haiku-5-5` pour l'enfant. La version Claude Code 2.1.323 est documentée pour les deux essais de lecture ; la version exacte du binaire n'a pas été conservée pour chaque essai. Dans l'essai Codex, le binaire de télémétrie venait du worktree après retrait du POC ; les deux bras utilisaient le même.

**Lecture marketplace, consigne identique dans les deux bras :**

> Pour `aidd marketplace refresh` d’une marketplace GitHub, retrace le parcours jusqu’au catalogue chargé. Explique l’effet de `--force`, le comportement si une référence n’existe pas, si l’authentification échoue, si le catalogue contient des sources locales relatives ou si le JSON est invalide. Précise si l’échec d’une marketplace interrompt les autres, et ce que les tests existants démontrent effectivement. Cite les chemins et lignes qui justifient tes conclusions.

Le témoin travaille directement. La variante reçoit un rappel de délégation, avec un explorer temporaire `Read`, `Grep`, `Glob` et `omitClaudeMd: true` ; le hook de gros fichier est désactivé dans les deux bras. L'oracle préétabli vérifie notamment `--force`, le fallback vers `HEAD` après un `404` sur une référence explicite différente de `HEAD`, le cas d'authentification, le traitement d'un JSON invalide et la poursuite du traitement des autres marketplaces. Une commande Bash du témoin a échoué mais la réponse a été produite ; la revue indépendante a comparé les réponses au code.

**Omission sur le retrait Codex, brief enfant identique dans les deux bras :**

> Pour `aidd plugin remove <nom> --tool codex`, explique le comportement en périmètre projet puis avec `--scope user`. Comment le plugin et sa référence native sont-ils identifiés ? Quels contrôles précèdent le retrait ? Que deviennent les fichiers, les références du projet et de la machine et le cache lorsqu’un autre projet dépend du plugin ? Que se passe-t-il si le binaire Codex est absent ? Appuie-toi sur le code et les tests existants, en citant chemins et lignes. Travaille en lecture seule : ne modifie aucun fichier, ne lance aucun test et n’appelle aucun service externe.

Les deux parents lancent l'explorer. Seul le champ `omitClaudeMd: true` change dans la copie de l'agent ; le hook de gros fichier est désactivé. L'oracle couvre notamment la distinction projet / utilisateur, les références partagées et les deux erreurs citées plus haut.

**Écriture, consigne identique dans les deux bras :** le témoin crée le fichier ; la variante demande à un agent temporaire limité à `Write` de le créer, puis le parent vérifie et lance Vitest. La cible est absente initialement. La consigne ci-dessous reprend l'original ; pour retrouver son texte exact, entourer le chemin de sortie de deux accents graves. Le SHA-256 du texte transmis, sans espaces en début ni fin, est `8376bf5b76e98d3dda9b6813970399555ab7ceb5d7214a6a131ace62a0dd2876`.

```text
Dans ce dépôt, ajoute uniquement cli/tests/contexts/tools/domain/formats/models/agent-models-holdout.unit.test.ts avec Vitest. Utilise comme fichier de référence `cli/tests/contexts/tools/domain/formats/models/agent-models.unit.test.ts` et teste les exports de `cli/src/contexts/tools/domain/formats/models/agent-models.ts`.

La suite doit vérifier avec des valeurs attendues explicites, sans snapshot :
- `agentProviders()` contient exactement `anthropic`, `mistral` et `openai` et `agentHostIds()` exactement `claude`, `codex`, `copilot`, `cursor`, `kilo` et `opencode` ;
- `isAgentHost('claude')` est vrai, tandis que `unknown` et `toString` sont faux ;
- `supportedProvider('codex', 'openai')` renvoie `openai` ; avec `codex` et `mistral`, l'erreur nomme le fournisseur, l'hôte et le choix `openai` ; avec l'hôte `nonesuch`, l'erreur nomme l'hôte inconnu ;
- `tierModel('claude', 'anthropic', 'light')` renvoie le modèle `claude-haiku-5-5` et l'effort `medium` ; pour Copilot/Anthropic/light le modèle natif est `claude-haiku-5.5` et l'effort `medium` ; pour OpenCode/Mistral/light le modèle est `mistral/mistral-small-latest` et l'effort `high` ;
- `roleModels('claude', 'anthropic')` renvoie dans cet ordre le groupe `reviewer` avec `claude-opus-5-5`/`high`, puis le groupe `explorer`, `executor`, `validator` avec `claude-haiku-5-5`/`medium`, sans entrée standard vide.

N'utilise ni snapshots ni assertions toujours vraies. Ne modifie aucun autre fichier. Lance `pnpm --dir cli exec vitest run --project=unit tests/contexts/tools/domain/formats/models/agent-models-holdout.unit.test.ts` et rapporte le résultat.
```

L'oracle externe exécute Vitest sans pipeline et vérifie que les huit modifications suivantes font échouer une assertion, pas simplement le chargement du test. Le nom de chaque mutation est indicatif ; les deux chaînes qui suivent sont le remplacement exact dans `agent-models.ts` :

```js
const mutants = [
  ['provider list', 'return Object.keys(AGENT_MODELS.providers) as AgentProvider[];', 'return [];'],
  ['host list', 'return Object.keys(AGENT_MODELS.hosts) as AgentHost[];', 'return [];'],
  ['host must be own key', 'Object.hasOwn(AGENT_MODELS.hosts, id)', 'id in AGENT_MODELS.hosts'],
  ['provider compatibility', 'if (!providers.includes(provider)) {', 'if (false) {'],
  ['provider prefix', 'const prefix = AGENT_MODELS.hosts[host].providerPrefix === true ? `${provider}/` : "";', 'const prefix = "";'],
  ['native model alias', 'profile.nativeModels?.[host] ?? profile.model', 'profile.model'],
  ['effort tier', 'effort: profile.effort,', 'effort: "low",'],
  ['tier ordering', 'return tiers.flatMap((tier) => {', 'return tiers.reverse().flatMap((tier) => {'],
];
```

La commande Vitest exécutée par les parents passait par `tail` sans `pipefail` : son seul code de sortie ne prouvait donc pas la réussite. La vérification externe a confirmé 11 tests pour le témoin, 13 pour la variante et **8 mutations détectées sur 8** pour chacun.

### Compteurs conservés

Les colonnes sont des tokens, sauf `Requêtes`. `Nouvelle` exclut le cache ; les créations et lectures de cache sont deux catégories séparées. Les événements API et les métriques OTLP sont deux vues des mêmes requêtes, non deux quantités à additionner. Le cas KPI à −13,4 % utilisait le code du commit [`ddddfb255`](https://github.com/ai-driven-dev/framework/commit/ddddfb2552db6667d7a2cd8689aa922dd54a8291) et une copie de plugin temporaire.

| Cas | Modèle | Requêtes | Nouvelle | Création cache | Lecture cache | Sortie |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Marketplace direct | Sonnet parent | 11 | 22 | 80 201 | 664 880 | 12 120 |
| Marketplace délégué | Sonnet parent | 4 | 8 | 30 239 | 176 106 | 4 628 |
| Marketplace délégué | Haiku enfant | 21 | 44 | 138 405 | 1 404 043 | 29 867 |
| Création directe | Sonnet parent | 4 | 8 | 101 848 | 176 028 | 2 260 |
| Création déléguée | Sonnet parent | 7 | 14 | 88 306 | 431 213 | 2 541 |
| Création déléguée | Haiku enfant | 1 | 2 | 3 436 | 0 | 1 872 |
| Codex sans omission | Sonnet parent | 2 | 4 | 38 164 | 56 686 | 2 702 |
| Codex sans omission | Haiku enfant | 21 | 42 | 129 037 | 1 723 792 | 25 687 |
| Codex avec omission | Sonnet parent | 2 | 4 | 24 005 | 72 440 | 2 565 |
| Codex avec omission | Haiku enfant | 14 | 28 | 116 897 | 826 854 | 15 088 |
| KPI sans omission | Sonnet parent | 2 | 4 | 3 469 | 92 850 | 1 366 |
| KPI sans omission | Haiku enfant | 2 | 4 | 100 520 | 15 048 | 3 508 |
| KPI avec omission | Sonnet parent | 2 | 4 | 37 828 | 58 381 | 1 399 |
| KPI avec omission | Haiku enfant | 2 | 4 | 72 197 | 14 308 | 3 627 |

Les scripts du banc, prompts, réponses, agrégats et traces se trouvent encore dans `.tmp/context-routing-poc/` du worktree expérimental, notamment `limited-explorer/`, `native-writer-minimal/`, `omit-holdout/` et `real-v2/omit/`. Ils ne sont **pas versionnés** et peuvent disparaître ; les payloads OTLP bruts n'ont pas été conservés. Cette note et la PR gardent les données utiles pour concevoir un nouvel essai, pas de quoi recalculer ou reproduire exactement chaque requête initiale.

Le 18 novembre 2026, sur le commit PR `777636fd2`, les contrôles GitHub `Mutation (telemetry)` et `cli / gate` ont échoué : score de mutation **81,6 % pour un seuil de 96 %**. Ce résultat concerne la télémétrie, pas la qualité du POC de routage. [Exécution CI](https://github.com/ai-driven-dev/framework/actions/runs/44281153794/job/134740809690).

## Écarts observés, sans en déduire une cause unique

- **Périmètre.** Spotify rapporte le contexte de Claude ; nos tableaux comptent aussi les sous-agents et le cache. Ils ne répondent pas à la même question. Le monorepo, les tâches et les modèles diffèrent également.
- **Travail du sous-agent.** Dans notre essai `marketplace refresh`, l'explorer a fait 47 lectures ou recherches et consommé 1 572 359 tokens. Spotify transmet d'emblée des fichiers nommés à une invocation Portal ; le nombre de requêtes internes à Portal n'est pas connu.
- **Allers-retours du parent.** Pour notre générateur limité, le worker n'a consommé que 5 310 tokens, mais le parent est passé de quatre à sept requêtes et de 280 144 à 522 074 tokens. Il a notamment relu le fichier et lancé un contrôle supplémentaire. Les traces ne permettent pas d'attribuer le surcoût exact à chaque action.
- **Lectures ciblées.** Notre hook expérimental refusait aussi les `Read` partiels sur un fichier trop long ; celui de Spotify les autorise. Nous n'avons pas démontré que cette différence explique à elle seule les écarts.
- **Instructions.** `omitClaudeMd` omet les instructions utilisateur, projet et locales au démarrage d'un sous-agent Claude ; pour les agents non gérés comme dans notre POC, les politiques gérées restent et des règles de sous-dossier peuvent se charger ensuite. Le canari utilisé n'a pas prouvé séparément l'absence de tous les `AGENTS.md`. Les contraintes indispensables doivent rester disponibles pour la tâche. [Documentation Claude](https://code.claude.com/docs/en/sub-agents#what-loads-at-startup).

Le hook testé demandait au parent de déléguer mais ne lançait pas lui-même un agent ; il ne bloquait pas les autres moyens de lire un fichier. Un agent limité à `Write` a été testé pour **créer** un fichier absent, pas pour modifier ou vérifier seul un fichier existant.

## Protocole minimal pour un prochain essai

1. **Fixer avant l'essai** une tâche réelle, un budget d'expérimentation, une réponse ou des tests de référence, et un critère de qualité. Ne pas publier le mécanisme comme utile avant la mesure.
2. Comparer au **workflow réellement utilisé avant le changement** : direct contre nouvelle délégation, ou délégation existante contre délégation allégée. Garder code, consigne, modèles et environnement comparables.
3. Mesurer séparément parent et chaque worker : entrée, sortie, création et lecture de cache, requêtes et durée. Réconcilier les compteurs sans additionner deux vues des mêmes appels. Calculer un éventuel coût avec des tarifs datés par modèle et catégorie, séparément des tokens.
4. Vérifier la qualité indépendamment avec des sources ou les mêmes tests et mutations ; ne pas supprimer une vérification nécessaire pour afficher un gain. Une erreur de mesure, un timeout ou un refus donne **un résultat inconnu**, pas zéro.
5. Répéter dans l'ordre inverse puis sur une autre tâche, sans choisir uniquement les runs favorables. Conserver les traces nécessaires à l'audit. Les derniers essais ont conservé des agrégats OTLP/API cohérents, mais pas les payloads OTLP bruts permettant un recalcul indépendant par requête.

Un gain sur le seul parent, un résumé plus court ou un résultat isolé ne suffit pas à valider une économie reproductible sur la tâche complète.
