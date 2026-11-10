---
status: approved
---

# aidd-ui PR4 : identité, écrans, vitrine

Une personne qui conçoit l'UI avec une IA choisit entre des variantes qu'elle voit et manipule : une identité liée à son sujet plutôt qu'un rendu générique d'IA, puis tout ce que l'UI a produit, navigable depuis un seul point d'entrée.

## Clair

- Skills dans l'ordre du chemin : `01-journeys`, `02-brand`, `03-foundations`, `04-components`, `05-screens`, `06-review` ; `07-feature` en PR5, `08-audit` en PR6. `01-system` disparaît, éclaté en `brand`, `foundations` et `components`.
- Termes du domaine : marque (personnalité, ton, références), fondations (couleur, typo, espacement, mouvement, élévation), niveaux Atomic Design `atom`, `molecule`, `organism` (ex `composition`), plus `asset`. Wireframe et écran gardent leur nom ; la vitrine les range sous templates et pages.
- Chaque sorte de fiche a un seul skill auteur : naissance, déduction depuis le code, évolution. Pas de skill de changement : le moteur propage (`impact`, `bump`) et marque les dépendants en retard, que leur auteur reprend.
- Les skills se passent le relais par les fichiers, sans se nommer : `foundations` lit la direction retenue dans `brand.md` ; `screens` s'arrête sur un composant manquant.
- `brand` et `screens` proposent toujours au moins deux variantes, `foundations` et `components` sur demande. Chaque variante déclare son intention et ses axes ; la créativité vient de l'échange et du sujet, le skill guide la décision sans prescrire le style.
- Le moteur porte la mécanique des variantes, pour qu'aucun skill ne la redéfinisse : les brouillons dans `aidd_docs/ui/drafts/`, ignorés par git ; la variante retenue devient une fiche, les autres partent ; il vérifie au moins deux variantes, une intention chacune, une vraie différence sur les axes déclarés.
- Page de comparaison : HTML statique, JS intégré, sans serveur. Basculer A/B/C, deux côte à côte, écarter, état et thème, une note par variante. Le retour s'écrit dans `drafts/<id>/feedback.json` quand le navigateur le permet, sinon il se copie dans le chat ; le moteur définit un seul format pour les deux.
- Le moteur vérifie sans IA le contraste texte et fond de chaque écran dans chaque thème, et la taille des zones tactiles.
- Review : page statique, verdict par écran, état et version. `publish` couvre écrans et wireframes.
- Vitrine façon Storybook, générée par le moteur (`showcase`, lancée en fin de chaque skill) : accueil, une page par fiche, navigation dans l'ordre du chemin, liens utilise et utilisé par. Elle réutilise le code de la page de comparaison. Deux générations sur les mêmes fiches donnent le même résultat.
- `aidd-orchestrator:03-design-system`, en PR7, propose l'ordre sans l'imposer.
- Chaque skill suit le format lean de brainstorm, plan et implement : un `SKILL.md` qui aiguille par le flux de ses actions, une action par fichier, des règles transverses courtes. Chaque mot a une raison d'être.
- Découpage, chaque PR utilisable seule et prouvée : 4a restructuration, sans régression sur les pilotes ; 4b variantes et `brand`, trois directions distinctes sur un pilote vierge ; 4c écrans, contraste, zones tactiles ; 4d review et `publish` ; 4e vitrine ; à la fin, une vérification complète puis une passe lean et de dédoublonnage sur tout le plugin.
- Preuve : moteur en TDD, une mutation par garde ; tests de structure (gabarits valides, aucun skill nommé, aucun lien hors dossier, un seul auteur par sorte de fiche) ; un script de pilote, dans le dépôt, hors CI, relancé à chaque PR, enchaîne les skills avec Haiku sur des copies jetables (vierge, Gouvernail, Kairos) et vérifie sans IA : `validate` VALID, chaque étape a son wireframe, chaque wireframe son écran, code des projets intact.

## Supposé

- Zone tactile : plancher de 24 px, celui de WCAG 2.2 AA que l'audit applique ; `system.md` peut le relever par plateforme (44 iOS, 48 Android). Aucun nom de plateforme n'est réservé, le moteur ne devine rien.
- Les brouillons ne sont jamais versionnés : seul le choix compte, l'historique le garde.

## Ouvert

- L'écriture du retour par la page en `file://` (API File System Access, Chromium) : vérifiée en 4b ; si elle échoue, le copier-coller reste seul et la limite s'écrit.
