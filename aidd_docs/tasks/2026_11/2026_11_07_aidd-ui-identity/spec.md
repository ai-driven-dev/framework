# aidd-ui : identité, écrans, vitrine

## Target

Une personne qui conçoit l'UI avec une IA choisit entre des variantes qu'elle voit et manipule une identité, des fondations, des composants et des écrans, puis parcourt tout ce que l'UI a produit depuis un seul point d'entrée.

## Hard constraints

### Amendements au contrat d'ensemble

- Les skills suivent l'ordre du chemin : `01-journeys`, `02-brand`, `03-foundations`, `04-components`, `05-screens`, `06-review`. `01-system` disparaît, éclaté dans les trois suivants ; `07-feature` et `08-audit` restent réservés aux PR 5 et 6.
- Le niveau `composition` devient `organism` partout où le contrat le nomme : arborescence, fiches, cycle de vie. Une fiche qui porte encore `composition` est refusée comme tout niveau inconnu, sans migration : le plugin est en alpha.
- Le flux de changement ne vit plus dans un skill (décision 2) : chaque sorte de fiche a un seul skill auteur, qui la fait naître, la déduit du code et la fait évoluer ; le moteur propage par `impact` et `bump` et marque les dépendants en retard, que leur auteur reprend.
- Depuis rien, aucun skill ne propose plus « la marque et les tokens » d'abord (spec des parcours) : l'ordre se lit dans la numérotation, et seul l'orchestrateur le proposera.
- L'arborescence gagne `drafts/<id>/`, brouillons de variantes, ignorés par git et jamais versionnés.

### Transverses

- Un skill ne nomme aucun autre skill et ne lie rien hors de son dossier ; les skills se passent le relais par les fichiers.
- Le plugin ne livre aucune règle.
- Le moteur seul écrit `history.md`, `code-debt.json`, `tokens.css`, `tokens.resolver.json` et la vitrine. Seules une review puis `publish` rendent une fiche `validated`.
- Chaque skill suit le format lean : un `SKILL.md` qui aiguille par le flux de ses actions, une action par fichier, des règles transverses courtes.
- Le moteur avance en TDD, une mutation par garde. Des tests de structure tiennent : gabarits valides, aucun skill nommé, aucun lien hors dossier, un seul auteur par sorte de fiche.
- Un script de pilote, dans le dépôt et hors CI, relancé à chaque tranche, enchaîne les skills avec Haiku sur des copies jetables (vierge, Gouvernail, Kairos) et vérifie sans IA : `validate` VALID, chaque étape a son wireframe, chaque wireframe son écran une fois les écrans livrés, code des projets intact.

### 4a : restructuration

- `02-brand`, `03-foundations` et `04-components` reprennent tout ce que faisait `01-system`, sans rien ajouter que le relais par les fichiers que la séparation impose : la direction dans `brand.md`, l'élément déjà relevé pour la tâche dans `history.md`.
- `03-foundations` lit la direction retenue dans `brand.md`.

### 4b : variantes et marque

- `02-brand` propose toujours au moins deux variantes ; `03-foundations` et `04-components` sur demande. Chaque variante déclare son intention et ses axes ; le skill guide la décision sans prescrire de style.
- Le moteur porte seul la mécanique des variantes : il vérifie au moins deux variantes, une intention chacune, une vraie différence sur les axes déclarés ; la variante retenue devient une fiche, les autres sont effacées.
- La page de comparaison est un fichier statique, sans serveur : basculer entre variantes, en mettre deux côte à côte, en écarter une, changer d'état et de thème, noter chacune.
- Le retour de la page a un seul format, écrit dans `drafts/<id>/feedback.json` quand le navigateur le permet, sinon copié dans le chat.

### 4c : écrans, contraste, zones tactiles

- `05-screens` propose toujours au moins deux variantes, et s'arrête sur un composant manquant sans le créer.
- Le moteur vérifie sans IA le contraste texte et fond de chaque écran dans chaque thème, au seuil WCAG 2.2 AA.
- Le moteur vérifie la taille des zones tactiles : plancher de 24 px, que `system.md` peut relever par plateforme ; aucun nom de plateforme n'est réservé.
- Un écran sans wireframe est un avertissement (décision 4).

### 4d : review et publication

- La page de review est statique : verdict par écran, par état et par version, confronté à la capture de l'app réelle une fois l'écran codé (décision 4) ; elle produit la fiche review.
- `publish` couvre écrans et wireframes.
- La review couvre aussi les composants, comme le décide le contrat d'ensemble.

### 4e : vitrine

- Le moteur génère la vitrine par `showcase`, lancée en fin de chaque skill : accueil, une page par fiche, navigation dans l'ordre du chemin, wireframes et écrans rangés sous templates et pages, liens « utilise » et « utilisé par ».
- Elle partage le socle de la page de comparaison, et tient les décisions 4 du contrat : bascule thème et plateforme, deux combinaisons côte à côte, habillage neutre, `proposed` marqué.
- Deux générations sur les mêmes fiches donnent le même résultat.

## Non-goals

- `ui.md` de feature, audit, orchestrateur : PR 5, 6 et 7.
- Versionner les brouillons ou garder les variantes écartées.
- Prescrire un style, une palette ou une police.
- Une page de comparaison ou de review servie par un serveur.

## Done-when

- 4a : sur les trois pilotes, le script donne les mêmes erreurs, les mêmes wireframes et un code intact qu'avant la restructuration, et aucune fiche ne porte plus `composition`. Les avertissements suivent les choix du modèle d'une exécution à l'autre et ne comptent pas.
- 4b : sur le pilote vierge, `02-brand` produit trois directions distinctes, comparées dans la page, et la retenue devient `brand.md` ; un jeu de variantes sans intention ou sans différence est signalé.
- 4c : sur les trois pilotes, chaque wireframe a son écran ; un contraste sous le seuil et une zone tactile trop petite sont signalés.
- 4d : un écran et son wireframe revus OK puis publiés passent `validated` ; un verdict sur une version antérieure ne compte pas.
- 4e : sur chaque pilote, toute fiche est atteignable depuis l'accueil, et deux générations sont identiques.
- Fin : le script de pilote et les tests de structure passent sur tout le plugin, puis aucune phrase n'y est écrite deux fois.

## Open Questions

- TBD: la page ouverte en local peut-elle écrire `feedback.json` elle-même ? Vérifié en 4b ; si non, le copier-coller reste seul et la limite s'écrit.

## Context

- Brief approuvé : [brainstorm](./brainstorm.md).
- Contrat d'ensemble amendé ici, décisions numérotées par PR : [spec aidd-ui](../../2026_10/2026_10_30_aidd-ui-rework/spec.md).
- Tranche précédente : [spec des parcours](../2026_11_06_aidd-ui-journeys/spec.md).
