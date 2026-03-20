# Code Review for Command Layer Refactor

Audit de la couche `src/application/commands/` et de sa conformité avec l'architecture hexagonale, les règles de responsabilité par couche, et la cohérence globale du projet.

- Statut: 🔴 Requires Refactoring
- Confidence: 95%

## Main expected Changes

- [ ] Exposer `Manifest.DEFAULT_DOCS_DIR` et `Manifest.DEFAULT_REPO` en static — les commandes lisent la responsabilité de l'entité, sans module `defaults` externe
- [ ] Ajouter `validateDocsDir()` dans `manifest.ts` (parallèle à `validateRepoFormat()`) — les use-cases valident, les commandes ne touchent pas aux invariants de domaine
- [ ] Déplacer les agrégations (`totalWritten`, `totalDeleted`, etc.) dans les `*Result` des use-cases — les commandes affichent, ne calculent pas
- [ ] Supprimer les helper functions dans les commandes (`selectAndInstall`, `displayInstallResult`) — inline ou use-case, jamais fonction libre
- [ ] Standardiser le pattern d'erreur : validation CLI flags (hors try/catch) + tout le reste dans try/catch via `output.exit(error)`
- [ ] Uniformiser `isInteractive` : `process.stdout.isTTY && !cmdOptions.force && !cmdOptions.dryRun` — identique partout, inline

## Scoring

### Potentially Unnecessary Elements

- [🟢] Dead code: aucun code mort détecté (knip confirme 0 issues en production)
- [🟡] **`displayInstallResult()` dans setup.ts** `setup.ts:353-381` fonction helper utilisée 1 seule fois — à inliner directement dans le handler
- [🟡] **`selectAndInstall()` dans setup.ts** `setup.ts:307-351` function de 45 lignes qui orchestrait autrefois un use-case supprimé — pourrait devenir une méthode d'un use-case dédié

### Standards Compliance

- [🔴] **`DEFAULT_DOCS_DIR` dupliqué 3 fois** `setup.ts:17`, `init.ts:8`, `manifest.ts:5` — la constante de domaine doit vivre dans `manifest.ts` et être importée ailleurs
- [🔴] **`DEFAULT_REPO` dupliqué 2 fois** `config.ts:8`, `errors.ts:1` — même problème
- [🟡] **`VALID_DOCS_DIR` regex dupliquée** `setup.ts:16`, `init.ts:7` — doit vivre dans le domaine comme fonction de validation
- [🟡] **Chemins `.aidd` hardcodés dans 4 fichiers** `cache.ts:21,53`, `memory-script-use-case.ts:10-11`, `adopt-use-case.ts:156`, `clean-use-case.ts:69-70` — aucun point de vérité unique pour la structure `.aidd/`
- [🟢] Conventions de nommage respectées
- [🟢] Exports nommés uniquement, pas d'`export default`

### Architecture

- [🔴] **setup.ts : switch statement de 250 lignes dans le handler** `setup.ts:56-268` — le handler est une machine à états interactifs. La logique d'orchestration doit vivre dans un use-case, pas dans la commande
- [🔴] **update.ts : sélection de scope dans le handler** `update.ts:70-137` — le handler calcule les outils modifiés, construit les choix UI, et parse la sélection. Tout cela appartient au use-case
- [🟡] **config.ts : validation et persistance conditionnelle** `config.ts:141-198` — vérification si la valeur a changé + logique de confirmation = responsabilité du use-case
- [🟡] **restore.ts : sélection interactive de fichiers** `restore.ts:100-134` — construction de la liste des fichiers dérivés + sélection = responsabilité du use-case
- [🟡] **sync.ts : sélection de source dans le handler** `sync.ts:50-104` — comptage des modifications par outil + construction des choix = responsabilité du use-case
- [🟡] **Commands appelant des validateurs de domaine directement** `config.ts:142` `validateRepoFormat()`, `restore.ts:48-49` `assertValidToolIds()` — les use-cases doivent recevoir l'input brut et lever des erreurs de domaine eux-mêmes
- [🟡] **`isLocalPath()` dans resolve-framework-use-case.ts** `resolve-framework-use-case.ts:13-21` — logique de détection de type de chemin appartient au domaine (value object `FrameworkSource`)
- [🟢] Injection de dépendances respectée dans tous les use-cases
- [🟢] Pas d'import d'infrastructure depuis le domaine

### Code Health

- [🔴] **setup.ts dépasse 150 lignes** 382 lignes total, handler principal 287 lignes
- [🟡] **update.ts dépasse 150 lignes** 212 lignes total, handler 192 lignes
- [🟡] **config.ts dépasse 150 lignes** 206 lignes total
- [🟡] **restore.ts dépasse 150 lignes** 195 lignes total
- [🔴] **Pattern d'extraction des globalOptions répété 14 fois** dans tous les fichiers de commandes — aucun helper commun
  ```typescript
  const globalOptions = program.opts<{ verbose: boolean; repo?: string; token?: string }>();
  const verbose = globalOptions.verbose ?? false;
  const output = new CLIOutput(verbose);
  const projectRoot = process.cwd();
  const deps = await createDeps(projectRoot, { verbose, ... }, output);
  ```
- [🟡] **Pattern isInteractive répété dans 4 commandes** `update.ts:70-75`, `restore.ts:93-98`, `sync.ts:54-56`, `setup.ts:26-29`
- [🟡] **Agrégation des résultats dans les handlers** `setup.ts:235-241`, `update.ts:196-202`, `restore.ts:182-188` — les use-cases doivent exposer les totaux, pas laisser les commandes calculer `result.tools.reduce(...)`
- [🟢] Pas de nombres magiques non documentés
- [🟢] Pas de `any` explicite dans les use-cases

### Error Management

- [🔴] **Validation errors avant try/catch** `adopt.ts:54-55`, `config.ts:68-70`, `restore.ts:42-45`, `update.ts:39-42` — ces blocs appellent `output.error()` + `process.exit(1)` en dehors du try/catch, contournant `output.exit()`
- [🟡] **Vérification TTY répétée** `setup.ts:26-29`, `adopt.ts`, `install.ts`, et 9 autres — aucun helper commun `requireTTY(output, message)`

### Performance

- [🟢] Pas de requêtes réseau inutiles détectées
- [🟢] Cache framework correctement utilisé

---

## Final Review

- **Score**: 5.5 / 10
- **Feedback**: La couche de commandes a dérivé vers un rôle d'orchestrateur et de UI manager. Ce qui devrait être de simples "wire → call → display" contient de la validation métier, des agrégations, des calculs d'état interactif, et des constantes de domaine dupliquées. Le refactor doit se concentrer sur trois axes : (1) remonter les constantes vers le domaine, (2) déplacer la logique de sélection/agrégation dans les use-cases, (3) extraire le boilerplate répété des commandes.
- **Follow-up Actions**:
  1. `Manifest` → ajouter `static readonly DEFAULT_DOCS_DIR = "aidd_docs"`, `static readonly DEFAULT_REPO = "ai-driven-dev/aidd-framework"`, et `static validateDocsDir(name: string): void` — supprimer les doublons dans `init.ts`, `setup.ts`, `config.ts`, `errors.ts`
  2. Chaque `*Result` de use-case expose ses agrégats (`totalWritten`, `totalDeleted`, `toolCount`) — supprimer tous les `reduce()` des commandes
  3. Supprimer `selectAndInstall()` et `displayInstallResult()` de `setup.ts` — inline ou déplacer dans `InstallUseCase`
  4. Standardiser le pattern d'erreur dans toutes les commandes : validation CLI flags UNIQUEMENT hors try/catch, tout le reste dans `catch (error) { output.exit(error); }`
  5. Unifier `isInteractive` : même calcul, même forme inline dans chaque commande concernée
- **Additional Notes**: Pas de module `defaults` externe — le domain non-anémique veut que les entités portent leurs propres invariants et valeurs par défaut. Les helpers libres sont interdits dans les commandes. La taille des fichiers sera une conséquence naturelle du refactor, pas un objectif. La règle `0-layer-responsibilities.md` est la plus violée et doit être l'étoile polaire du refactor.
