# Rolling weekly releases

> Brainstorm — 2026-06-19. Idée consolidée, niveau intention. Pas de plan ni de code.

## L'idée

Shipper le framework chaque semaine, vite et de façon cadencée, tout en gardant une norme de branches qui permet les hotfix — sans qu'un nouvel utilisateur reçoive jamais du code non-versionné.

Le framework est un monorepo de plugins distribué via une marketplace : les utilisateurs suivent la branche par défaut du repo à son sommet. Aujourd'hui les features arrivent directement sur cette branche, donc un nouvel utilisateur qui installe récupère du code fusionné mais pas encore publié, sous un ancien numéro de version. C'est le défaut à corriger.

## Faits qui cadrent la décision

- Le numéro de version d'un plugin sert de clé de cache : sans incrément, un utilisateur déjà installé ne reçoit rien.
- La marketplace suit la branche par défaut à son sommet ; un nouvel utilisateur prend donc l'état courant de cette branche, versionné ou non.
- Pour une marketplace tierce, la mise à jour automatique est désactivée par défaut côté utilisateur.
- La résolution de version prend le numéro porté par le plugin en premier.

## La forme retenue

Deux branches : une branche de **production** (celle que suivent les utilisateurs, qui ne doit contenir que du publié) et une branche d'**intégration** où s'accumulent les features de la semaine.

- Les features et corrections passent par l'intégration.
- Quand c'est prêt, l'intégration est promue vers la production, ce qui déclenche une publication versionnée **fusionnée automatiquement**, puis une remontée **automatique** de la production vers l'intégration pour resynchroniser.
- Un hotfix part de la production, y revient en publication dédiée hors cadence, puis est remonté vers l'intégration.

Le gestionnaire de versions existant est conservé et reste la source de l'incrément.

Alternative écartée : faire surveiller au gestionnaire de versions la branche d'intégration puis fast-forward vers la production. Garantit une production mathématiquement pure (zéro fenêtre d'exposition) mais impose un double suivi et une remontée fragile — complexité jugée supérieure au bénéfice.

## Contraintes non négociables

- La publication versionnée doit être fusionnée automatiquement. Sinon, entre la promotion et la publication, la production contient des features non versionnées et un nouvel utilisateur les capte. L'auto-fusion réduit cette fenêtre à la durée d'un passage d'intégration continue.
- La remontée production → intégration doit être automatique, sinon les états de version et de journal divergent.

## Risque résiduel assumé

Une fenêtre d'exposition de l'ordre d'un passage d'intégration continue subsiste, une fois par semaine, sur une petite base d'utilisateurs. Jugée négligeable au regard de la simplicité gagnée.

## Assumptions ouvertes (à confirmer à l'étape suivante)

- **Où tourne le gestionnaire de versions aujourd'hui** : aucun workflow d'automatisation dans le module `framework/` lui-même ; il tourne probablement à la racine du monorepo parent. À vérifier avant toute modification.
- **Nom de la branche d'intégration** : `next` envisagé, renommable.
- **Cohérence des numéros embarqués dans le manifeste de marketplace** : aujourd'hui figés et divergents des numéros réels des plugins. À nettoyer pour une source unique.
- **Cadence stricte vs opportuniste** : publication seulement s'il y a eu du travail dans la semaine.

## Prochaine étape

L'idée est mûre pour une **planification technique** : traduire ce modèle de branches en automatisations concrètes (promotion, auto-fusion de la publication, remontée, protections de branches), documenter le flux de contribution, et vérifier d'abord où l'automatisation de version s'exécute réellement.
