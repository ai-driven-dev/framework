# Phase 1 — Preuves runtime

Validation effectuée le 10 octobre 2026, sur des données synthétiques dans `/tmp/aidd-914-runtime-codex-project`. Aucun compte Anthropic ni achat utilisé. Aucun runtime Claude authentifié exécuté. La preuve porte sur la mémoire de phase 1, pas sur les générateurs des phases suivantes.

## Génération par Codex natif

Le caller de cette session Codex a réellement invoqué le routeur installé `aidd-context:02-project-memory`, puis exécuté son action `sync` en liant explicitement les sources candidates `actions/04-sync.md`, `references/tools.md` et le hook actualisé. Il ne s'agit pas d'une modification de l'installation utilisateur. Le choix préalable est `kilo` seulement ; le seul signal Kilo est `kilo.json`. Le fichier AGENTS existant ne constitue pas un signal de détection.

Le caller a exécuté `node hooks/update_memory.js --check kilo` avant l'Upsert, ajouté la section Memory Management à partir du template sans changer le préfixe utilisateur, exécuté `node hooks/update_memory.js kilo`, puis relu le lien exact vers `aidd_docs/memory/architecture.md` et vérifié le résultat. Les contrôles explicites ont renvoyé `0`. Le contenu produit et le hash du hook sont conservés dans [les artefacts JSON](evidence/phase-1/runtime-generated-artifacts.json). Le [reçu des étapes caller](evidence/phase-1/runtime-codex-caller-receipt.json) complète ces artefacts. Les commandes et lectures natives du caller sont dans la conversation de cette session ; cette archive ne prétend pas être une trace CLI de cette génération.

Trois essais supplémentaires de Codex CLI 0.162.0 ont réellement sélectionné le skill local de fixture, mais n'ont pu lire son action ni générer les fichiers : `codex-code-mode-host` absent. La désactivation transitoire du host et la conservation du modèle utilisateur `gpt-6.1-sol` n'ont pas corrigé ce blocage. Leurs sorties `0` ne sont pas une réussite fonctionnelle. Aucun outil réinstallé ni configuration utilisateur modifiée. Les traces sont conservées dans [essai 1](evidence/phase-1/runtime-codex-attempt-1.jsonl), [essai 2](evidence/phase-1/runtime-codex-attempt-2.jsonl) et [essai 3](evidence/phase-1/runtime-codex-attempt-3.jsonl).

## Consommation réelle par Kilo

Commande exécutée, avec XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_STATE_HOME et XDG_CACHE_HOME isolés sous `/tmp/aidd-914-runtime-xdg` :

```sh
kilo run --pure --dir /tmp/aidd-914-runtime-codex-project \
  --model kilo/cohere/north-mini-code:free --format json \
  'What is the answer to the phase 1 memory verification question? Read the project instructions and relevant project memory, and apply its answer convention. Do not modify files.'
```

Le prompt ne contient ni le chemin mémoire ni la réponse attendue. AGENTS contient seulement le lien produit par AIDD ; la réponse et sa convention résident dans la mémoire liée. La trace montre que le modèle voit ce lien, appelle réellement `read` sur `aidd_docs/memory/architecture.md`, puis répond exactement `MEMORY_APPLIED:prune-6842`. Code de sortie `0`, deux étapes avec coût `0`, AGENTS et banque mémoire inchangés après exécution. Cela démontre la découverte du contexte AGENTS et l'utilisation effective de la mémoire liée pour accomplir la tâche. Voir [trace runtime](evidence/phase-1/runtime-kilo.jsonl) et [assertions observées](evidence/phase-1/runtime-verification.json).

Les métadonnées récupérées avant le test indiquent `isFree: true`, entrée/sortie/cache à `0`, et `mayTrainOnYourPrompts: true`. La fixture ne contient que des données synthétiques. `kilo auth list` rapporte zéro credential dans l'état isolé : l'accès gratuit effectif fonctionne sans connexion à un compte enregistré. Cette observation ne garantit pas la disponibilité future du modèle. Voir [métadonnées](evidence/phase-1/runtime-kilo-model.json).

Deux lectures superflues de chemins `.kilo/command/*.md` et `.kilo/agent/*.md` ont échoué parce que ces artefacts ne font pas partie de la fixture. La lecture mémoire et la réponse sont réussies ; ces essais ne valident aucun générateur de commandes ou agents. Un premier diagnostic séparé, portant sur une autre fixture remplie directement par le hook, a atteint son timeout de 100 secondes sans événement runtime ; il est conservé dans [trace du diagnostic](evidence/phase-1/runtime-kilo-hook-only-attempt.jsonl). La preuve principale ci-dessus utilise bien l'artefact généré par le caller Codex.

Kilo a ajouté automatiquement le champ `$schema` à son fichier de fixture `kilo.json` au démarrage. Le préfixe utilisateur, AGENTS et la mémoire sont restés identiques ; le changement de configuration avant/après est conservé dans les assertions JSON. Il ne faut pas attribuer cette écriture au générateur AIDD.

Les [hashes des sources finales](evidence/phase-1/runtime-source-hashes.json) permettent de vérifier que le hook de fixture correspond au candidat ; les hashes des essais CLI antérieurs restent [archivés séparément](evidence/phase-1/runtime-cli-attempt-source-hashes.json).

## Limites

Cette preuve satisfait le parcours mémoire Kilo de phase 1. Elle ne valide pas intégralement les critères runtime de l'issue qui exigent des artefacts des phases 2 à 6. La génération par un sous-processus Codex CLI reste bloquée par le host absent ; la génération effective validée ici est celle du caller natif de la session actuelle. OpenCode n'est pas installé ; ses garanties de phase 1 doivent s'appuyer sur les tests automatisés. Claude peut être validé hors ligne pour les artefacts, mais aucun comportement de modèle Claude authentifié n'a été testé.
