# Suivi CI multiplateforme — correction sécurité #992

Ce suivi accompagne `filesystem-access.md`. Il conserve les constats des contrôles GitHub après le commit publié `d5f1309a`; il ne remplace ni ne modifie les preuves brutes antérieures.

## Alertes CodeQL #125–#128

Le contrôle CodeQL de la PR #992 a signalé deux opérations de fichier sujettes à TOCTOU dans le test des hardlinks et deux créations de fichiers prévisibles dans la suite de substitutions (`scripts/__tests__/update-memory.test.js`, anciennes lignes 492, 498, 530 et 532). Les chemins directement sous le répertoire temporaire partagé pouvaient être précréés ou entrer en collision; le test des hardlinks réécrivait puis relisait des chemins après l'appel au hook au lieu de garder des témoins stables.

- Les témoins de contenu sont maintenant ouverts avant l'opération et lus par leurs descripteurs. Les assertions comparent identité, liens, mode, taille, date de modification et octets via ces descripteurs. La vérification que le chemin d'origine désigne encore le témoin ouvre une fois le chemin puis inspecte le descripteur obtenu.
- Les fichiers et répertoires extérieurs sont créés sous des répertoires uniques issus de `mkdtempSync`, puis supprimés dans `finally`. Les descripteurs sont fermés avant la suppression, y compris pour les systèmes qui refusent de supprimer un fichier encore ouvert.
- Les tests de substitution vérifient le marqueur d'injection, le refus de production et l'absence de mutation des témoins; ils ne relisent pas les chemins contrôlés après la course.

Le statut CodeQL de ces quatre alertes après modification reste à confirmer par une nouvelle analyse GitHub. Leur correction locale ne permet pas de conclure à leur clôture dans Code Scanning.

## Échecs Windows observés

Le job Windows avait signalé sept échecs répartis ainsi : assertions de frontmatter sensibles à LF dans les fixtures agent et skill; hashes calculés sur octets CRLF de checkout au lieu des octets canoniques LF; attente de refus d'accès fondée sur `chmod(0555)`; attente de bits de mode POSIX exacts; et deux variantes de substitution du répertoire parent dont les assertions dépendaient d'un renommage puis d'un lien symbolique et d'un chemin `.held`.

- Les textes des fixtures sont normalisés CRLF vers LF seulement pour les assertions sémantiques et les hashes d'oracle; les hashes historiques restent ceux des octets canoniques LF.
- Le refus de préflight est testé par injection déterministe d'une erreur `EACCES`, sans prétendre que les ACL Windows reproduisent les permissions POSIX.
- Le test de mode exige `0640` sur POSIX et vérifie la conservation du mode effectivement rapporté sur Windows.
- POSIX teste les substitutions réelles par renommage et lien symbolique. Pour le parent sur Windows, où le remplacement physique du répertoire n'est pas portable, un hook de test injecte une identité de parent différente après l'ouverture. Dans les deux cas, le refus de production et les témoins par descripteur sont vérifiés. Ce scénario Windows teste la détection de changement d'identité, pas toutes les courses de répertoires possibles.

Les échecs rapportés concernaient les hypothèses de tests et leurs oracles; aucun défaut de production n'a été démontré par ces logs. Une CI Windows verte reste nécessaire avant de conclure à la compatibilité Windows. macOS et Windows ne sont pas disponibles dans cette validation locale.

## Statut AIDD et limites

- La phase 2 de #914 reste `in-progress`, en attente de coordination avec le writer de #979. Aucun writer ni fichier d'intégration de #979 n'est modifié.
- La phase 6 reste inachevée et hors de cette correction.
- Les quatre alertes antérieures #116–#119 sont indiquées comme résolues ou obsolètes dans les commentaires de la PR, mais leur statut Code Scanning interne n'a pas pu être confirmé : la lecture de l'API Code Scanning a renvoyé HTTP 403.
- Les validations locales Linux ne prouvent pas les permissions, liens symboliques, identité de fichiers ni substitutions sous Windows/macOS. Les jobs GitHub Actions et l'analyse CodeQL doivent être examinés après la publication autorisée du correctif.

## Validations locales

- `node scripts/check-tests-leave-git-alone.js --watch .git/hooks -- node --test scripts/__tests__/update-memory.test.js scripts/__tests__/context-agent-command-artifacts.test.js scripts/__tests__/context-skill-artifacts.test.js scripts/__tests__/kilo-rule-publication.test.js scripts/__tests__/context-kilo-detection.test.js` — 118 tests réussis.
- `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` — 664 tests réussis, zéro échec ou skip.
- `pnpm test:changed` — code de sortie 0.
- `make check` a été lancé, mais Lefthook a sauté toutes ses commandes parce que les modifications étaient unstaged; ce résultat n'est pas compté comme validation.
