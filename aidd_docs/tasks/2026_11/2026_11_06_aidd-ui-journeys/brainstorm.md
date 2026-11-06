---
status: approved
---

# aidd-ui : des personas au code vérifié

Une personne qui conçoit l'UI avec une IA est guidée des personas au code vérifié : chaque skill a une frontière nette, un orchestrateur propose l'ordre sans l'imposer.

## Clair

- Chemin proposé depuis rien : personas, parcours, wireframes, marque et tokens de base, écrans habillés, `ui.md`, code, vérification. La personne reste libre de l'ordre.
- Le design system démarre petit : `01-system` propose marque et tokens d'abord, la personne crée plus si elle veut ; un composant naît surtout quand un écran le demande.
- Les personas appartiennent au brief d'`aidd-pm`. `aidd-ui` les lit, ne les écrit jamais ; un parcours renvoie à un persona par un identifiant stable.
- Un parcours (`journeys/<id>.md`) nomme son persona et ses étapes, chaque étape un écran ; une étape sans écran crée un wireframe vide en `proposed`.
- Un wireframe est un fichier à part (`wireframes/<id>.md` et `.html`) : zones nommées, composants attendus, états, aucun token ni couleur.
- Un écran porte le même identifiant que son wireframe et le cite par `wireframe: <id>@<version>` : un wireframe qui monte de version met l'écran en retard, et le moteur vérifie que l'écran couvre chaque zone et chaque état.
- Un écran se dessine sans parcours. La skill d'écran ne crée jamais de composant : il en manque un, elle s'arrête et renvoie au design system.
- La review juge par écran, état et version, dans une page statique. Un écran déjà codé exige une capture de l'app réelle, fournie par les outils de test ; `aidd-ui` ne lance jamais l'app.
- L'accessibilité n'a pas de skill. Le moteur vérifie sans IA, à l'écriture, le contraste des couples texte et fond que chaque fiche déclare, dans chaque thème, la taille des zones tactiles et la réduction des animations ; la review a une ligne accessibilité par état ; l'audit juge le reste, sur WCAG 2.2 AA.
- `aidd-ui` n'écrit que dans `aidd_docs/ui/`, plus `ui.md` et la review d'une tâche, jamais dans le code. Le moteur seul écrit l'historique, `tokens.css` et la vitrine. Seuls une review puis `publish` rendent un élément `validated`. Seul l'orchestrateur nomme un autre skill.
- Découpage, chaque PR utilisable seule : PR3 parcours et wireframes ; PR4 écrans, review, vitrine, contraste ; PR5 `ui.md` et capture du réel ; PR6 audit ; PR7 orchestrateur dans `aidd-orchestrator` et étape UI de l'onboarding.
- Chaque skill suit le format lean de brainstorm et plan : chaque mot a une raison d'être.

## Supposé

- La vitrine reste une sous-commande du moteur, générée sans IA, comme le dit la spec.
- Un même skill écrit les parcours et dessine les wireframes : les deux décrivent la structure, avant tout style.
- Web et mobile suivent le même chemin : un wireframe ne dépend d'aucune plateforme, l'écran porte les siennes.

## Ouvert

- Le format de l'identifiant d'un persona dans le brief revu d'`aidd-pm`.
- La taille minimale d'une zone tactile : 24 px de WCAG 2.2 AA, ou 44 et 48 recommandés par iOS et Android, selon la plateforme.
- Le chemin d'une app existante, sans parcours ni wireframe : entre-t-elle par l'extraction puis les écrans ?
