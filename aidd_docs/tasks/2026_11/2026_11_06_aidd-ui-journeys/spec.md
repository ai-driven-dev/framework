# aidd-ui : parcours et wireframes

## Target

Depuis un persona, une personne obtient ses parcours et le wireframe de chaque écran qu'ils traversent, sans aucun style, vérifiés sans IA.

## Hard constraints

- Le persona est demandé à la personne ; un persona déjà décrit dans un brief est repris tel quel. Le parcours porte son nom et sa description.
- Un parcours porte son persona et ses étapes ordonnées, chaque étape un écran et l'action qui mène à la suivante.
- Une étape dont l'écran n'a pas de wireframe en crée un vide, `proposed`, qui porte son nom et le but de l'étape.
- Un wireframe vit dans `aidd_docs/ui/wireframes/<id>`, fiche et rendu, sous un identifiant unique comme toute fiche ; l'étape le nomme, l'écran qui l'habillera le citera.
- Une fiche de wireframe porte ses zones nommées, les composants qu'elle attend par leur nom, et les états d'un écran.
- Un rendu de wireframe n'est que structure, sans aucun style, et ne dépend d'aucune plateforme.
- Un composant attendu qui n'existe pas est nommé, jamais créé, et signalé en avertissement.
- Sur une app existante, les parcours et wireframes se déduisent de ses écrans réels, puis la personne les confirme.
- Un wireframe a `status` et `version` comme tout élément : le modifier monte sa version et l'historique ; il reste `proposed`, la review qui le validera venant ensuite.
- La vérification, à chaque écriture et à la main, signale un parcours sans persona, une étape qui ne nomme ni écran ni wireframe ou sans action, et tout style dans un wireframe.
- Depuis rien, le design system propose de commencer par la marque et les tokens ; la personne reste libre d'en créer plus.
- Le skill ne nomme aucun autre skill, et suit le format lean : chaque mot a une raison d'être.

## Non-goals

- Écrire ou modifier un brief.
- Écran habillé, review, vitrine, contraste et zones tactiles : la PR suivante.
- `ui.md` de feature, audit, orchestrateur.
- Un wireframe par plateforme.

## Done-when

- Sur le pilote vierge, depuis un persona, chaque parcours voulu existe, et chacune de ses étapes a un wireframe avec ses états et aucun style.
- Un parcours sans persona, ou une étape qui ne nomme ni écran ni wireframe, est signalé.
- Un wireframe modifié a une version de plus et sa ligne d'historique.
- Sur Gouvernail et Kairos, les parcours et wireframes sont déduits des écrans existants.
- Chaque nouvelle règle a un cas qui la fait échouer.

## Open Questions

None

## Context

- Frontières et décisions : [brainstorm](./brainstorm.md).
- Contrat d'ensemble, à amender pour les wireframes : [spec aidd-ui](../../2026_10/2026_10_30_aidd-ui-rework/spec.md) ; découpage : [roadmap](../../2026_10/2026_10_30_aidd-ui-rework/roadmap.md).
