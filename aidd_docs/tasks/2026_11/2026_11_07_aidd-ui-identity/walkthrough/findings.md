---
objective: "Lancer chaque skill d'aidd-ui à la main, de 01 à 06, sur un projet vierge puis sur une copie de Kairos, et noter chaque écart avant de corriger quoi que ce soit."
status: in-progress
---

# Passage : chaque skill à la main

Gel : aucune règle ni page nouvelle pendant le passage. Les corrections viennent après, par lots, d'après ce tableau.

Ensuite : `feature`, `audit`, puis l'orchestrateur, selon la [feuille de route](../../../2026_10/2026_10_30_aidd-ui-rework/roadmap.md).

## Écarts

| Projet | Skill | Seul | Dans le flow | Écart | Gravité |
| --- | --- | --- | --- | --- | --- |
| vierge | 01 | oui | | Première question : « Which task folder should history.md rows cite? ». Elle parle du mécanisme interne (history.md, citer) et demande un choix que la personne ne sait pas faire. Le skill devrait prendre un dossier par défaut et le dire, sans poser la question. | moyenne |
| vierge | 01 | oui | | Deuxième question : persona, but et produit en une seule question. L'option 1 « I'll describe it, pick Other » double « Type something » : un choix vide. Le même doublon revient à la question suivante. Constaté : choisir cette option n'envoie aucun texte, et le skill doit reposer la question. | moyenne |
| vierge | 01 | oui | | Troisième question : la liste des parcours et de leurs étapes est demandée à la personne. Proposer d'abord, puis faire approuver, devrait être le comportement par défaut, pas une option parmi d'autres. | moyenne |
| vierge | 01 | oui | | La proposition de parcours est bonne : 4 parcours, des étapes concrètes. Mais le parcours 2 fait jouer un second acteur, le client, et contient une étape qui n'est pas un écran (« Designer gets notification »). Aucune règle de 01 ne couvre ni l'un ni l'autre : le skill a improvisé. | basse |
| vierge | 01 | oui | | Juste après un passage propre de 01, `validate` sort en 1 sur T1 (tokens.json absent), avec 54 avertissements R18 (composant absent). La personne voit une erreur qu'elle ne peut pas corriger à cette étape. Et le conseil de T1, « run extract », n'a aucun sens sur un projet vierge, puisqu'il n'y a rien à extraire. | haute |
| vierge | 01 + vitrine | oui | | Avis de la personne : « je comprends rien, c'est pas très beau ». | haute |
| vierge | 01 + vitrine | oui | | Un wireframe n'affiche que le nom de ses zones, en texte brut (« nav summary actions invoice-list »), avec la police par défaut du navigateur : pas de boîtes, pas de mise en page. | haute |
| vierge | 01 | oui | | Les quatre états d'un wireframe (default, empty, loading, error) sont identiques au caractère près : l'état n'apporte rien, et la vitrine demande pourtant un OK pour chacun. | haute |
| vierge | vitrine | oui | | Sur chaque page de wireframe, un bloc « Engine checks » répète les avertissements R18 (composant absent). Le design system n'existe pas encore : c'est du bruit, écrit en jargon. | haute |
| vierge | vitrine | oui | | Un parcours s'affiche en tableau Screen / Action, sans flèches ni enchaînement visible, et les écrans du tableau ne sont pas des liens. | moyenne |
| vierge | vitrine | oui | | La rubrique des wireframes s'appelle « Templates » dans la navigation, un mot que rien n'explique. | moyenne |
| vierge | vitrine | oui | | Dès la fin de 01, la vue d'ensemble demande de valider les 16 wireframes (« Still to review », « All OK, copy »), alors qu'il n'y a encore rien à juger. | moyenne |
| vierge | 01 | oui | | Le compte rendu de fin est clair : où sont les fichiers, ce qui a été ajouté et pourquoi, rien de commité. | aucune, à garder |
| vierge, second passage | 01 | oui | | Mieux : une seule question, une proposition concrète, plus d'option vide. Les zones montrent du vrai contenu, les états diffèrent, `validate` sans erreur, compte rendu en mots simples. | aucune, à garder |
| vierge, second passage | 01 | oui | | La question annonce le dossier de tâche juste après « start from scratch » : la personne croit que les fichiers iront dans `tasks/` et non dans `ui/`. | moyenne |
| vierge, second passage | 01 | oui | | Persona et parcours sont demandés en une seule question, puis tout est écrit. Avis de la personne : « il me pose pas trop de questions, il génère directement tout ». | moyenne |
| vierge, troisième passage | 01 | oui | | Deux arrêts respectés : la persona seule, puis 3 parcours validés avant toute écriture. Le dossier de tâche n'est plus mentionné. | aucune, à garder |
| vierge, troisième passage | 01 | oui | | Lancé sans demande sur un projet vide, 01 invente quatre produits (facturation, tâches, e-commerce, clinique) pour avoir une proposition. Avis de la personne : est-ce pertinent ? Non, la personne connaît son produit. | moyenne |
| vierge, troisième passage | vitrine | oui | | Avis de la personne : « beaucoup mieux ». Restent : « Still to review » coché d'avance et « All OK, copy » incompris ; trop de chips dans l'en-tête ; la description arrive en fin de page ; `Uses` et `Used by` mal placés ; état répété à côté de OK et Revise ; défilement horizontal du storyboard. Voulu : un panneau de review à droite, façon GitHub, cumulé sur toutes les pages. | moyenne |
| vierge, troisième passage | vitrine | oui | | Limite non vérifiée : Firefox donne à chaque page `file://` son propre stockage. Le panneau n'y cumulerait pas les verdicts d'une page à l'autre. Aucun Firefox sur la machine, donc aucun code pour ce cas. | limite |
| vierge, quatrième passage | 01 | oui | | Projet vide : 01 demande le produit et pour qui, sans rien inventer. Puis la persona seule, puis les parcours, avant toute écriture. Compte rendu en français simple. Avis de la personne : « les échanges, c'était beaucoup mieux ». | aucune, à garder |
| vierge, quatrième passage | vitrine | oui | | Avis de la personne : « beaucoup mieux ». Restent : la navigation montre les identifiants (« demarrage » lu « dénarrage ») ; l'en-tête est à moitié gris ; le storyboard passe à la ligne sur grand écran alors que la place existe ; d'un écran du parcours, aucun moyen d'aller au suivant sans revenir en arrière ; le statut est à placer en haut à droite ; « proposed » n'est pas traduit. | moyenne |
| vierge, second passage | vitrine | oui | | Avis de la personne : le parcours n'est « pas beau », le tableau des étapes est toujours là, le HTML « fait cheap et année 2000 ». Un wireframe est « mieux mais pas très lisible, limite de l'ASCII » : styles par défaut du navigateur sur fond sombre, états empilés, cadre trop haut. | haute |

## Frontières entre skills, vues par la machine

Lecture des skills contre la spec et la feuille de route. Aucun skill ne refait le travail d'un autre : chacun écrit ses propres fichiers.

| Skill | Écart | Preuve | Gravité |
| --- | --- | --- | --- |
| 02 à 05 | La boucle comparer, garder, réviser est copiée quatre fois, avec quatre règles de départage différentes. | `02-brand/actions/03-choose.md`, `03-foundations/actions/02-write.md`, `04-components/actions/02-write.md`, `05-screens/actions/03-choose.md` | moyenne |
| 03, 04, 05 | Après un changement de token, aucun skill ne répare un écran qui cite un token disparu. 03 renvoie V3 à « another skill », 05 dit « Nothing owed ». | `03-foundations/references/engine.md`, `05-screens/references/engine.md` | haute |
| 06 | Une review partielle est impossible : un état sans verdict bloque l'écriture. La spec veut garder les écrans restants et reprendre. | `06-review/actions/03-choose.md`, spec « Review » | moyenne |
| 06 | Pas de ligne d'accessibilité par état, que le brainstorm prévoyait. | `06-review/references/review.md` | basse |
| 01 | Un écran sans wireframe donne un avertissement, mais aucun skill ne déduit le wireframe depuis l'écran, comme la spec le demande. | `hooks/lib/records.cjs`, spec décision 4 | basse |
| aucun | `publish` sans identifiant, qui monte la version du design system, n'est lancé par aucun skill. | `06-review/references/engine.md` | moyenne |
| 03, 04 | Arrêt dur sans le skill précédent, alors que le brainstorm laisse la personne libre de l'ordre. | `03-foundations/actions/01-prepare.md`, `04-components/actions/01-prepare.md` | à trancher |
| 04, 05 | Écrivent un lien `code` à l'extraction : ce n'est pas encore le travail de `feature`, qui met ces liens à jour après le code. | `04-components/references/extraction.md`, `05-screens/references/screens.md` | aucune, à garder en tête |
| tous | Décision, pour le moment : le moteur reste dans `hooks/`, appelé par chaque skill. C'est une exception à « un skill ne pointe pas hors de lui-même ». Écartés : la CLI (outil de plus à installer), un skill unique, des copies par skill (environ 41 000 lignes livrées). Restent dus : tester l'installation à plat, et faire charger au hook la vérification seule, sans le code qui crée. | `hooks/lib/hook.cjs:9`, `skills/*/references/engine.md` | à faire |

## Pilote, vu par la machine

Pilote relancé de 01 à 06, traces gardées, sur un projet vierge puis sur une copie de Kairos. Le pilote répond seul aux questions : les points d'attente d'un humain n'y apparaissent pas.

| Projet | Skill | Écart | Preuve | Gravité |
| --- | --- | --- | --- | --- |
| vierge | 03 → 04, 05 | 03 écrit `type.body` et `type.heading` en composites `typography` portés par `$extensions` seul. `tokens.css` en sort `--type-body: font-family: …;;`, une valeur inutilisable. 04 et 05 veulent un token sémantique, jamais une primitive : ils retirent toute la typo, et les écrans prennent la police du navigateur. Vérifié : `dressed 0/7`. | `03-foundations/references/tokens.md` (« each with family, size, line height, weight »), `04-components/references/elements.md`, `05-screens/references/screens.md`, `tokens.css` du pilote | haute |
| les deux | 01 à 06 | Le hook refuse selon l'ordre d'écriture : H1 et V1 avant `bump`, R12 avant les wireframes. Sur Kairos 04, ids en points contre tirets : douze fiches réécrites trois fois. | traces `*.04-components.trace.jsonl` | haute |
| Kairos | tous | Bruit persistant : T1 après 01 et 02, R18, environ 250 avertissements C3, C4 et V6 ; `validate` sort en 1. | traces, `walk-kairos.log` | moyenne |
| les deux | 06 | Les parcours ne sont jamais publiés. | `*.06-review.trace.jsonl` | moyenne |
| les deux | 04, 05 | La règle « never read its source » est violée : lecture de `hooks/aidd-ui.cjs` et grep dans `hooks/lib`. | `blank.04-components.trace.jsonl`, `blank.05-screens.trace.jsonl` | moyenne |
| Kairos | 03, 04, 06 | Lectures sous `~/.claude/projects`. | traces Kairos | moyenne |
| les deux | tous | Une dizaine de commandes bash composées bloquées par projet. | traces | basse |
| Kairos | 03 | `extract` refuse, l'assistant écrit quand même, puis relance avec `--force`. | `*.03-foundations.trace.jsonl` | moyenne |
| les deux | 05 | Premier `compare` sans `--root`, sortie 2. Sur Kairos, `compare && keep` enchaînés sans pause pour la personne. | `*.05-screens.trace.jsonl` | moyenne |
| les deux | 02 | `brand.md` sans front matter après `keep` (R1) ; `help brand` sort en 2. | `*.02-brand.trace.jsonl` | basse |

Seule la première ligne est revérifiée sur pièces ; les autres viennent de la lecture des traces par un agent.
