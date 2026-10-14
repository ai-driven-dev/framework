# SDLC : rendre le mode `interactive` à l'orchestrateur

Le SDLC va aujourd'hui du besoin à la pull request sans jamais s'arrêter. Avant un refactor il
avait un mode `interactive` par défaut et `auto` sur demande ; le refactor a gardé l'autonomie et
jeté le reste. On veut l'inverse de l'ancien réglage : autonome par défaut, `interactive` sur
demande. Pour quelqu'un qui lance une vraie livraison et veut valider le contrat, la spec et le
plan avant que ça parte, mais qui n'a aucune envie d'arbitrer chaque agent lancé.

La bascule qui évite la sur-ingénierie : on ne s'arrête pas à chaque délégation, on s'arrête là où
un artefact corrigible vient d'être produit. Quatre points, pas dix. Et ces quatre points sont un
seul comportement de l'orchestrateur, pas quatre mécaniques : aucune des étapes appelées ne change.

## Ce qui est clair

- Le mot est `interactive`, jamais `manual`. Il est déjà employé par `aidd-vcs:01-commit:29`,
  `aidd-dev:01-plan/actions/04-plan.md:29`, `aidd-context:04-skill-generate/references/scope-frame.md:9`
  et `aidd-orchestrator:02-backlog/references/modes.md:5`. Un `manual` serait le doublon que
  `CLAUDE.md` interdit.
- Mot à l'invocation, rien de persisté : `<besoin|ticket>` seul, ou `auto <...>`, ou
  `interactive <...>`. Le frontmatter devient `argument-hint: request | auto | interactive`.
- Quatre arrêts en `interactive` : le contrat, la spec, le plan, le verdict.
- Aucune skill appelée ne change. `01-plan` lit déjà le contexte et bascule seul dès que
  l'orchestrateur cesse de se déclarer autonome (`04-plan.md:29`). `04-spec` n'a pas de branche
  interactive, donc son arrêt appartient à l'orchestrateur, qui s'arrête quand la spec lui revient.
- La boucle implement, assert, review, challenge tourne seule dans les deux modes.
- Un refus à un arrêt est un finding. `03-check.md` sait déjà renvoyer un finding vers Frame ou
  vers Deliver et repasser ; le refus humain emprunte ces chemins au lieu d'en créer.
- Le commit reste local en fin de Deliver, à chaque passage. Le push part une seule fois, après un
  verdict propre, dans les deux modes. Règle unique : le travail ne sort de la machine que validé,
  que le validateur soit humain ou autonome.
- Le push revient à `aidd-vcs:02-pull-request`. Une PR sur une branche absente du remote est
  impossible : cette skill a toujours eu cette précondition, tenue jusqu'ici par accident de
  séquence. Son « Never commit, push, or branch here » devient « Never commit or branch here »,
  plus une ligne qui pousse la branche quand le remote ne l'a pas, jamais en `--force`.
- Ce n'est pas un choix de confort : la recette livrée `ship-a-feature.md` enchaîne
  `/aidd-vcs:01-commit` puis `/aidd-vcs:02-pull-request` sans option `push`, et
  `02-pull-request/actions/03-create.md` ouvre la PR sans jamais vérifier que la head existe sur
  le remote. Aucune étape de la recette ne pousse, et rien dans le texte de la skill ne tient
  cette précondition : elle repose entièrement sur ce que fait l'outil configuré, ce qui tient
  ou casse selon qu'il est interactif ou non. Donner le push à la skill PR ferme ce trou.
- Garde-fou à ajouter en plus, pas à la place : `01-collect` vérifie que la head est sur le remote
  et échoue clairement sinon.

## Ce qui reste ouvert

- Le déplacement du push est la seule décision de ce brief qui ne sert pas le mode interactif.
  Elle vient d'une règle voulue explicitement : le travail ne sort de la machine que validé, que
  le validateur soit humain ou autonome. Elle change donc aussi le mode auto, pour tout le monde,
  et c'est le seul changement dont le périmètre dépasse `01-sdlc`.
- Reculer le push coûte la sauvegarde hors machine pendant tout Check, qui peut reboucler
  plusieurs fois vers Deliver. Le travail est committé, donc rien n'est perdu ; ce qu'on perd est
  la visibilité et la copie distante. Prix jugé acceptable, à écrire dans la référence plutôt qu'à
  redécouvrir plus tard.
- La description du skill ouvre sur « Autonomously orchestrates », faux dès qu'un second mode
  existe. Formulation à trouver. `CATALOG.md` et `README.md` en sont générés par hook et suivront,
  et le frontmatter est contrôlé au pre-commit, donc `argument-hint` n'est pas décoratif.
- `aidd-context:00-onboard/references/run/tiers.md:12` affirme « `01-sdlc` is autonomous by
  contract; do not downgrade it to `GUIDED` », à réconcilier. Et `flow.md:27` propose déjà
  « walk with me, step by step » contre « hand the whole flow to sdlc » : les deux branches se
  recouvrent en partie une fois `interactive` disponible.
- Reste à décider si les points d'arrêt s'écrivent une fois, en règle transversale du `SKILL.md`,
  ou zone par zone dans les trois références.

## Périmètre attendu

| Fichier | Change |
| --- | --- |
| `plugins/aidd-orchestrator/skills/01-sdlc/SKILL.md` | le mode, l'`argument-hint`, la description |
| `plugins/aidd-orchestrator/skills/01-sdlc/references/02-deliver.md` | le commit ne pousse plus |
| `plugins/aidd-orchestrator/skills/01-sdlc/references/03-check.md` | le push après un verdict propre |
| `plugins/aidd-vcs/skills/02-pull-request/SKILL.md` | le push, et sa vérification dans `01-collect` |
| `01-plan`, `04-spec`, `01-commit` | rien |

Les deux références changent pour le déplacement du push, qui est tranché. Où s'écrivent les
points d'arrêt, dans le `SKILL.md` ou dans chaque référence, reste ouvert et peut élargir ce
tableau.

## Prochain pas

Écrire la phrase de mode dans le `SKILL.md` du SDLC, puisque c'est elle qui fait basculer les
étapes appelées sans les toucher, et vérifier sur un run réel que `01-plan` prend bien sa branche
interactive quand l'orchestrateur ne se déclare plus autonome.
