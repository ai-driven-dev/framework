# aidd-ui : parcours et wireframes

## Target

Depuis un persona du brief produit, une personne obtient ses parcours et le wireframe de chaque écran qu'ils traversent, sans aucun style, vérifiés sans IA.

## Hard constraints

- Un persona vient du brief produit et se cite par son identifiant ; aidd-ui ne l'écrit jamais.
- Un parcours porte son persona et ses étapes ordonnées, chaque étape un écran et l'action qui mène à la suivante.
- Une étape dont l'écran n'a pas de wireframe en crée un vide, `proposed`, qui porte son nom et le but de l'étape.
- Un wireframe vit dans `aidd_docs/ui/wireframes/<id>`, fiche et rendu ; son identifiant sera celui de l'écran qui l'habille.
- Une fiche de wireframe porte ses zones nommées, les composants qu'elle attend par leur nom, et les états d'un écran.
- Un rendu de wireframe ne porte ni token ni valeur visuelle, et ne dépend d'aucune plateforme.
- Un composant attendu qui n'existe pas est nommé, jamais créé.
- Un wireframe a `status` et `version` comme tout élément : le modifier monte sa version et l'historique ; sans review, il reste `proposed`.
- La vérification, à chaque écriture et à la main, signale un persona inconnu, un écran d'étape sans wireframe et une valeur visuelle dans un wireframe.
- Depuis rien, le design system propose de commencer par la marque et les tokens ; la personne reste libre d'en créer plus.
- Le skill ne nomme aucun autre skill, et suit le format lean : chaque mot a une raison d'être.

## Non-goals

- Écrire ou modifier un persona.
- Écran habillé, review, vitrine, contraste et zones tactiles : la PR suivante.
- `ui.md` de feature, audit, orchestrateur.
- Un wireframe par plateforme.

## Done-when

- Sur le pilote vierge, depuis un persona du brief, chaque parcours voulu existe, et chacune de ses étapes a un wireframe avec ses états et aucune valeur visuelle.
- Un parcours qui cite un persona inconnu, ou une étape sans wireframe, est signalé.
- Un wireframe modifié a une version de plus et sa ligne d'historique.
- Chaque nouvelle règle a un cas qui la fait échouer.

## Open Questions

- TBD: sous quel identifiant le brief produit revu nomme-t-il un persona ?
- TBD: un composant attendu qui n'existe pas encore est-il une erreur, un avertissement ou rien tant que l'écran n'est pas habillé ?
- TBD: sur une app existante, les parcours et wireframes se déduisent-ils des écrans réels, ou cette étape est-elle sautée ?

## Context

- Frontières et décisions : [brainstorm](./brainstorm.md).
- Contrat d'ensemble, à amender pour les wireframes : [spec aidd-ui](../../2026_10/2026_10_30_aidd-ui-rework/spec.md) ; découpage : [roadmap](../../2026_10/2026_10_30_aidd-ui-rework/roadmap.md).
