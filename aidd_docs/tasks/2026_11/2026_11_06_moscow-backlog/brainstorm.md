---
status: approved
---

# Priorisation du backlog par MoSCoW

Pour les mainteneurs et les agents : un rang MoSCoW par issue, indépendant des milestones, qui sert à choisir quoi mettre dans chaque milestone hebdomadaire.

## Clear

- Méthode : MoSCoW à trois niveaux, Must, Should, Could. Won't est supprimé.
- MoSCoW est une propriété de l'issue seule, non liée à une milestone. Une issue garde son rang avec ou sans milestone.
- Il n'y a pas de plafond de Must. Le rang dit "prioritaire" ; le choix de ceux qu'on traite en premier se fait au moment de remplir une milestone.
- Milestones : une par semaine, thématique, datée d'un vendredi, conteneur d'issues. Remplissage : 1 ou 2 Must qui en font le thème, puis les autres issues. Objectif d'environ 3 milestones d'avance, sans règle ; le reste s'ajoute plutôt la semaine précédente.
- Entre plusieurs Must, le thème d'une milestone se choisit selon le jugement de l'équipe et les retours des utilisateurs (réactions, votes comptés de `GOVERNANCE.md`, Discord, Discussions).
- La milestone `This week` est fermée. Elle n'est plus utilisée.
- Emplacement : champ de projet single-select `MoSCoW` sur le projet 8. Un agent le lit via `gh project item-list` (comme `Status`), et il est visible dans les vues Kanban et Milestones. L'issue field d'organisation n'est pas lu par `gh issue view` (mesuré).
- Périmètre du classement : les items en Todo (40 au moment de l'audit). Les items en Ideation (29) n'ont pas de MoSCoW tant qu'ils ne sont pas acceptés.
- Suppression de l'issue field d'organisation `Priority` (4 High, 9 Low, 24 Medium, 34 sans valeur sur les issues ouvertes), seulement après le classement MoSCoW. Aucun workflow ni script ne le lit. Irréversible, donc feu vert explicite à ce moment.
- Un seul dépôt `framework` : rien côté `cli`.
- Nettoyage complet, dans ce périmètre :
  - les issues sans type (17 au moment de l'audit) reçoivent un type ;
  - `docs/MAINTAINERS.md` : le tableau des champs (il dit à tort que `Priority` est un champ de Projet), la règle "a milestone or a priority, never both", la ligne Triage ;
  - `GOVERNANCE.md` : la phrase "ordered by priority" ;
  - `.github/labels.yml` : le commentaire cite un champ `Effort` qui n'existe pas ;
  - `aidd_docs/memory/backlog.md` ;
  - le README du board : il décrit Phase, Work Type et Area, absents du projet.
- Le type `Epic` n'est pas utilisé : la création d'épics avec sous-tâches est jugée trop pénible. Il reste absent de la doc.
- Aucune des issues ouvertes n'a de milestone : elles seront rattachées après le classement.

## Assumed

- Les Must viennent du Todo, pas d'Ideation. Corrigeable.
- Les 4 `Priority` High servent d'indice pour choisir des Must, jamais de conversion automatique.
- Fermer `This week` suppose de détacher ou déplacer ses 3 PR ouvertes. À faire avant la fermeture.
- Les rangs posés au premier classement sont provisoires : une passe finale sur toutes les issues vérifie qu'elles sont toujours d'actualité et que leur MoSCoW tient.
- Le type de chaque issue sans type est proposé par l'agent, validé par le mainteneur avant écriture.
- Les sous-issues restent le moyen de hiérarchiser (3 parents au moment de l'audit), à la place d'`Epic`.

## Open

- Rien de bloquant.
