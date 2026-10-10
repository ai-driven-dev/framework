# AIDD #914 — Validation du plan et implémentation de la phase 1

## Mission et autorisation

Je valide le plan général de l'issue [AIDD #914](https://github.com/ai-driven-dev/framework/issues/914), sous réserve des ajustements précisés ci-dessous.

Je t'autorise à :
1. Vérifier et mettre à jour les artefacts du plan AIDD existant.
2. Contrôler leur cohérence après modification.
3. Utiliser réellement `aidd-dev:02-implement`.
4. Implémenter **uniquement la phase 1 : reconnaissance Kilo et mémoire partagée**, avec ses tests, sa documentation et ses validations.

**Cette autorisation ne concerne aucune autre phase.**

Aucun commit, push ou création de PR sans mon accord explicite.

---

## 1. Reprendre le contexte existant

Travaille dans le dépôt actuel :

`/home/coder/project`

Branche attendue :

`feat/kilo-native-generation-914`

Remotes existants :

- `origin` : `git@github.com:waewoo/framework.git`
- `upstream` : `git@github.com:ai-driven-dev/framework.git`

La branche a été créée depuis `upstream/next`.

Le framework AIDD est déjà installé et ses capacités ont été découvertes et utilisées pendant la planification.

**Ne recommence ni l'installation, ni la création de branche, ni la planification complète.**

Commence par vérifier la branche active et `git status`, sans modifier les branches ni écraser des fichiers existants.

### Artefacts à relire

Dossier :

`aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/`

Documents :

- `next-session.md` : contexte de reprise et décisions.
- `resume.md` : préparation de l'environnement.
- `user-request.md` : demande initiale et contraintes.
- `issue-914.md` : exigences officielles.
- `plan.md` : plan AIDD global.
- `phase-1.md` à `phase-6.md` : phases détaillées.
- `coverage-matrix.md` : traçabilité des 16 critères d'acceptation.
- `challenge.md` : revue du plan, confiance annoncée de 90 %.
- `test-strategy.md` : stratégie de tests et de preuves.
- `official-sources.md` : contrats et documentation Kilo.
- `overlap-979.md` : coordination avec la PR #979.
- `environment-evidence.md` : état des outils et vérifications réalisées.
- `planning-validation.md` : contrôles des artefacts.

Respecte également les instructions pertinentes de :

- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/ARCHITECTURE.md`
- `aidd_docs/memory/`

Les artefacts AIDD existants constituent la référence pour reprendre les travaux. Ne perds pas les décisions déjà enregistrées.

---

## 2. Étape préalable obligatoire : vérifier et ajuster le plan

**Avant toute implémentation**, examine les recommandations suivantes et compare-les avec le contenu réel de `plan.md`, des six phases et des documents associés.

Ne réécris pas le plan inutilement.

Ne duplique pas les exigences déjà présentes.

Complète uniquement ce qui manque, ce qui est ambigu ou ce qui mérite d'être rendu plus explicite.

### 2.1 Coordination avec la PR #979

La PR [#979](https://github.com/ai-driven-dev/framework/pull/979) introduit un writer autonome dans `aidd-context:05-rule-generate`.

Elle chevauche la génération des règles prévue en phase 2.

Conserver les décisions suivantes :

- Réutiliser le writer de #979, plutôt que créer un writer concurrent.
- Ne pas présumer d'une date de fusion.
- Ne pas bloquer les phases indépendantes de cette PR.
- Réévaluer son état avant le démarrage de la phase 2.
- Si #979 est fusionnée, adapter les travaux à sa version effectivement intégrée.
- Si #979 reste Draft, demander une décision explicite avant de développer la partie dépendante.
- Éviter les duplications et conflits architecturaux.
- Préserver ses comportements existants pour les cibles non Kilo.

J'ai sollicité l'avis du mainteneur concernant cette coordination. Sa réponse éventuelle pourra nécessiter un ajustement ultérieur du plan.

**Ne pas attendre cette réponse pour implémenter la phase 1.**

### 2.2 Tests progressifs obligatoires

Chaque tâche doit être accompagnée de tests et de validations adaptés dès son implémentation.

Préciser explicitement dans le plan :

- Tests pertinents idéalement rouges avant le changement.
- Implémentation minimale.
- Documentation associée.
- Exécution des validations automatisées.
- Validation runtime lorsqu'elle est possible et pertinente.
- Conservation des preuves.
- Mise à jour du statut réel de la tâche.

**Une tâche dont les preuves requises sont manquantes ne doit pas être déclarée entièrement validée.**

La phase 6 consolide les preuves, mais ne remplace pas les vérifications réalisées à chaque phase.

### 2.3 Simplicité et sécurité JSONC

Pour la phase 2 future :

- Privilégier une solution minimale satisfaisant les critères officiels.
- Préserver les instructions existantes, leur ordre, leurs doublons, les commentaires JSONC, les virgules finales et le formatage utilisateur.
- Prévoir la validation de toutes les destinations concernées avant mutation.
- Garantir l'absence d'écritures partielles sur les erreurs de configuration ou d'édition dangereuse couvertes par l'issue.
- Tester les échecs de publication multi-fichiers appropriés.
- Ne pas confondre renommage atomique d'un fichier et transaction atomique de plusieurs fichiers.
- Documenter honnêtement les limites face aux interruptions brutales ou pannes machine.
- Éviter un moteur transactionnel générique ou disproportionné.

Ces points sont des précisions sur le plan futur : **ils n'autorisent aucune implémentation de la phase 2 maintenant**.

### 2.4 CI et plateformes

Pour la phase 6 future :

- Réutiliser au maximum les tests, helpers et jobs CI existants.
- Vérifier les plateformes réellement supportées par Kilo et AIDD.
- Vérifier les contraintes du runner et des environnements CI avant d'élargir la matrice.
- Préférer des adaptations ciblées à une nouvelle infrastructure de tests.
- Préserver les contrôles CI existants et ne pas affaiblir leurs conditions de succès.

### 2.5 Non-régression à chaque phase

Chaque phase devra protéger les comportements existants des autres outils.

En particulier :

- Claude Code, dont les formats constituent la source canonique d'AIDD.
- Codex.
- OpenCode.
- Cursor, Copilot et toute autre cible effectivement concernée.

Les tests pertinents doivent être exécutés dès chaque phase, et non uniquement à la fin du projet.

Ne pas modifier un contrat existant uniquement pour faciliter le nouveau support Kilo.

### 2.6 Contrôle du plan ajusté

Après les éventuelles modifications :

1. Vérifier la cohérence entre `plan.md`, les six phases, `coverage-matrix.md`, `challenge.md` et `test-strategy.md`.
2. Conserver les 16 critères officiels sans les modifier.
3. Vérifier qu'aucune exigence importante n'a été perdue.
4. Vérifier les liens et références.
5. Réutiliser le mécanisme de contrôle AIDD pertinent si une modification substantielle le nécessite.
6. Conserver les décisions précédentes et documenter brièvement les ajustements réellement apportés.

Ne pas relancer intégralement `01-plan` si une mise à jour ciblée suffit.

Ne pas présenter le score de challenge de 90 % comme une preuve de qualité de l'implémentation.

**Une fois cette vérification terminée, poursuivre directement avec la phase 1 autorisée.**

---

## 3. Utiliser réellement le workflow AIDD

Charge et applique le skill installé :

`aidd-dev:02-implement`

Respecte son contrat actuel, les phases AIDD et les instructions du dépôt.

Ne simule pas l'utilisation d'AIDD et n'invente pas de commande d'invocation.

La planification et le challenge ont déjà été effectués. Leur résultat doit être réutilisé.

Pour la phase 1 :

1. Charger `phase-1.md` et ses dépendances.
2. Vérifier les préconditions et les instructions des actions AIDD.
3. Écrire les tests pertinents.
4. Implémenter chaque tâche conformément au plan.
5. Mettre à jour la documentation associée.
6. Exécuter les contrôles nécessaires.
7. Enregistrer les preuves d'exécution.
8. Actualiser les statuts des artefacts AIDD selon leur contrat.
9. Effectuer les validations et la review de phase prévues ou applicables.

Respecter le workflow AIDD sans ajouter de cérémonial inutile.

Les unités de travail doivent rester cohérentes : **code, tests et documentation d'un même changement fonctionnel vont ensemble**.

Ne pas découper artificiellement ces éléments en tâches ou futurs commits indépendants.

---

## 4. Périmètre fonctionnel strict de la phase 1

La phase 1 concerne :

**Reconnaissance Kilo et mémoire partagée.**

Implémenter uniquement ce qui est prévu dans `phase-1.md`.

### 4.1 Détection de Kilo

Prendre en charge les signaux officiels :

- `.kilo/`
- `.kilocode/` comme signal historique uniquement.
- `kilo.json` à la racine.
- `kilo.jsonc` à la racine.
- `.kilo/kilo.json`
- `.kilo/kilo.jsonc`

Tester ces signaux séparément, puis les cas pertinents avec plusieurs outils.

Ne jamais détecter Kilo uniquement parce qu'un projet possède :

- `opencode.json`
- `opencode.jsonc`
- `AGENTS.md`

Ne pas modifier la détection OpenCode existante.

Ne jamais produire de nouveaux artefacts sous `.kilocode/`.

Pour les générateurs autres que ceux de cette phase, la mise en œuvre détaillée de leur détection reste dans leurs phases respectives.

Ne pas implémenter prématurément les phases 2 à 5.

### 4.2 Mémoire projet

Utiliser `AGENTS.md` à la racine comme surface principale de mémoire partagée pour Kilo.

Réutiliser les mécanismes existants de `aidd-context`.

Préserver strictement :

- Les textes écrits par l'utilisateur.
- Les blocs non contrôlés par AIDD.
- Les imports Claude existants.
- Les mécanismes des autres outils.
- Les conventions de synchronisation actuelles.

Ne modifier que les sections appartenant à AIDD.

Éviter les doublons lorsque Kilo, Codex et OpenCode utilisent le même fichier `AGENTS.md`.

Ne pas multiplier les écritures parce que plusieurs cibles désignent la même destination.

### 4.3 Sécurité des synchronisations

Prévoir les contrôles nécessaires avant toute mutation de la synchronisation explicitement demandée.

En particulier :

- Prévalidation des cibles sélectionnées.
- Contrôle des marqueurs AIDD.
- Gestion des blocs invalides ou ambigus.
- Vérification avant création ou modification des fichiers.
- Refus sûr lorsque les préconditions ne sont pas satisfaites.
- Idempotence sur exécutions répétées.

Un marqueur invalide dans une destination traitée en dernier ne doit pas laisser les premières destinations modifiées.

Conserver le fonctionnement attendu du hook automatique existant, sans le transformer inutilement.

### 4.4 Responsabilités existantes

Analyser et modifier uniquement les composants nécessaires, en particulier :

- `plugins/aidd-context/skills/00-onboard/`
- `plugins/aidd-context/skills/02-project-memory/`
- `plugins/aidd-context/hooks/update_memory.js`
- Leurs tests et fixtures pertinents.

Ne pas recréer `02-project-init`, disparu de l'architecture actuelle.

Ne pas modifier `01-bootstrap` sans justification établie.

Ne pas redévelopper les fonctionnalités CLI livrées par #744.

Ne pas empiéter sur la distribution flat de #868.

---

## 5. Protection des comportements existants

La compatibilité Kilo est une extension, pas une refonte des générateurs.

Respecter les principes suivants :

- Garder les sources canoniques Claude Code.
- Conserver les comportements actuels Claude, Codex, OpenCode et des autres outils.
- Réutiliser les composants, validations et utilitaires existants.
- Ne pas dupliquer les mécanismes de gestion de mémoire.
- Ne pas créer d'abstraction générique sans nécessité démontrée.
- Éviter tout refactoring hors périmètre.
- Ne pas modifier les profils CLI Kilo sans besoin relevant réellement de #914.

En cas de comportement existant ambigu, examiner son contrat et ses tests avant de le modifier.

Si un problème sans rapport avec la phase 1 est découvert, le signaler séparément sans élargir automatiquement l'implémentation.

---

## 6. Tests et preuves obligatoires pour la phase 1

Appliquer les exigences de `test-strategy.md` et les critères de `phase-1.md`.

### 6.1 Tests automatisés

Prévoir au minimum :

- Détection de chacun des six signaux Kilo.
- Cas `opencode.json[c]` seuls.
- Cas `AGENTS.md` seul.
- Projet Kilo-only.
- Projet multi-outils.
- Synchronisation mémoire sur cible partagée.
- Préservation exacte du contenu utilisateur hors bloc AIDD.
- Préservation des mécanismes Claude.
- Déduplication des destinations.
- Relance identique et idempotence.
- Bloc ou marqueur invalide.
- Invalidation d'une dernière destination sans modification partielle des précédentes.
- Absence de nouvelles sorties dans `.kilocode/`.

Utiliser des fixtures isolées et des fichiers réels lorsque la conservation des octets et les comportements filesystem sont en jeu.

Éviter les mocks qui masqueraient les régressions recherchées.

### 6.2 Validation runtime Kilo

Kilo CLI 7.8.8 est installé.

Un modèle gratuit a été testé avec succès :

`kilo/cohere/north-mini-code:free`

Il a répondu lors de la vérification de connectivité avec un coût déclaré de zéro.

Ce succès ne prouve pas encore le fonctionnement des artefacts #914.

Utiliser ce runtime lorsque pertinent pour vérifier la lecture réelle de la mémoire produite, et conserver les preuves observables.

Ne jamais basculer automatiquement vers un modèle payant.

Ne pas confondre détection d'un fichier par un loader et respect effectif de ses instructions par le modèle.

### 6.3 Claude Code

Claude CLI 2.1.296 est installé, mais je ne dispose pas de compte Anthropic.

L'API Anthropic est également inaccessible depuis cet environnement.

Par conséquent :

- Exécuter les tests de non-régression Claude possibles hors ligne.
- Vérifier les fichiers, formats, blocs, imports et comportements de synchronisation.
- Ne pas exiger une authentification Claude pour les tests qui n'en ont pas besoin.
- Ne pas prétendre qu'une validation runtime Claude avec modèle a été réalisée.
- Documenter explicitement cette limite au regard de `CONTRIBUTING.md`.

### 6.4 Codex, OpenCode et autres outils

Codex est l'environnement principal de génération et d'exécution des skills AIDD.

Pour OpenCode et les autres cibles concernées :

- Réutiliser les fixtures et tests pertinents.
- Vérifier les comportements existants affectés par les changements.
- Identifier les validations runtime manquantes.
- Ne pas installer inutilement de nouveaux runtimes pour cette seule phase sans nécessité établie.

### 6.5 Commandes et résultats

Exécuter les vérifications applicables prévues par le projet, dont les tests ciblés et `make check` lorsque pertinent.

Pour chaque validation importante, conserver :

- La commande exécutée.
- Son code de retour.
- Le résultat pertinent.
- Les éventuelles erreurs.
- Le fichier ou comportement validé.
- Les limites de la preuve.

Une tâche ne doit pas être déclarée entièrement validée lorsque les preuves obligatoires restent manquantes.

---

## 7. Coordination avec #979

J'ai sollicité l'avis du mainteneur sur le chevauchement avec :

https://github.com/ai-driven-dev/framework/pull/979

Cette PR introduit notamment un writer autonome pour la génération de règles.

Décisions :

- Ne pas attendre sa réponse pour travailler sur la phase 1.
- Ne pas développer de writer concurrent.
- Ne pas commencer la phase 2.
- Conserver l'alignement architectural prévu.
- Réévaluer la dépendance à #979 avant la phase 2.
- Ne pas anticiper sa fusion.
- Ne pas intégrer arbitrairement son code Draft dans la branche actuelle.

Les phases 3, 4 et 5 sont potentiellement indépendantes, mais leur implémentation nécessitera une autorisation distincte.

La phase 1 doit rester concentrée sur la détection et la mémoire.

---

## 8. Maintenabilité et stratégie de contribution

Privilégier des changements simples et ciblés.

Ne pas introduire de dette de maintenance pour satisfaire artificiellement les tests.

Respecter :

- Les conventions de code et de documentation AIDD.
- Les exigences de `CONTRIBUTING.md`.
- Le format canonique des skills.
- Les frontières de responsabilité architecturales.
- Les règles existantes dans `AGENTS.md`.

Les futurs commits devront être cohérents, relisibles et réversibles indépendamment lorsque pertinent.

Ne pas séparer artificiellement l'implémentation, les tests et la documentation d'un même changement.

### CI

Réutiliser la CI et les tests existants dès que possible.

Pour les phases futures, vérifier les plateformes réellement supportées avant tout élargissement multi-OS.

Aucune modification large de l'infrastructure CI n'est autorisée pendant cette phase sans nécessité directement liée au périmètre.

---

## 9. Livrables attendus

À la fin de la phase 1, présenter un rapport comprenant :

### A. Plan ajusté

- Recommandations déjà présentes.
- Recommandations ajoutées ou précisées.
- Fichiers de plan modifiés.
- Contrôle de cohérence réalisé.
- Éventuels désaccords ou arbitrages nécessaires.

### B. Implémentation

- Tâches terminées.
- Fichiers créés ou modifiés.
- Choix techniques importants.
- Comportements obtenus.
- Écarts éventuels par rapport au plan.

### C. Couverture des critères

Indiquer précisément les critères #914 concernés par la phase 1, leur statut réel et les preuves correspondantes.

Ne pas marquer comme entièrement validé un critère transversal nécessitant encore les générateurs des phases suivantes.

### D. Validation

- Tests rouges initiaux lorsqu'applicables.
- Tests après implémentation.
- Commandes et résultats.
- Vérifications de non-régression.
- Preuves runtime Kilo.
- Tests impossibles ou non exécutés.

### E. Qualité et suivi AIDD

- Contrôles de conformité du workflow `02-implement`.
- Review de phase, si applicable.
- Risques résiduels.
- Statuts des tâches AIDD actualisés.
- Prochaine phase suggérée, sans la commencer.

Enregistrer les preuves et informations de reprise dans le dossier de tâche existant.

Ne pas écraser les éléments historiques qui constituent des preuves de décisions ou d'exécutions précédentes.

---

## 10. Limites impératives

**Arrête-toi à la fin de la phase 1.**

Attends mon autorisation explicite avant de commencer une autre phase.

Tu es autorisé à :

- Ajuster les artefacts AIDD existants.
- Modifier les fichiers nécessaires à la phase 1.
- Créer ou adapter les tests et fixtures correspondants.
- Mettre à jour la documentation concernée.
- Exécuter les contrôles et tests appropriés.
- Conserver les preuves.

Tu n'es pas autorisé à :

- Commencer les phases 2 à 6.
- Modifier des fonctionnalités sans lien avec la phase 1.
- Changer de branche.
- Créer un commit.
- Pousser des changements vers GitHub.
- Ouvrir, modifier ou publier une PR.
- Réinitialiser ou nettoyer destructivement le dépôt.
- Utiliser des modèles payants Kilo sans accord.
- Installer une infrastructure supplémentaire disproportionnée.

En cas de blocage, présenter le problème et les options possibles sans dépasser le périmètre autorisé.

## Première action

Commence maintenant par :

1. Vérifier l'état Git.
2. Charger les instructions et artefacts AIDD existants.
3. Vérifier et ajuster le plan sur les cinq recommandations.
4. Contrôler la cohérence des artefacts.
5. Charger et exécuter réellement `aidd-dev:02-implement` pour la phase 1.
6. Tester, documenter et valider les changements.
7. Présenter les résultats puis t'arrêter.

**Ne redemande pas une validation générale du plan : celle-ci est accordée ici, avec les ajustements précédents. L'autorisation d'implémentation reste strictement limitée à la phase 1.**

## Précision ultérieure : commits locaux

L’utilisateur autorise ensuite les commits locaux par tâche de phase 1 validée, comprenant code, tests et documentation. Aucun push, PR, changement de branche ou implémentation des phases 2 à 6.
