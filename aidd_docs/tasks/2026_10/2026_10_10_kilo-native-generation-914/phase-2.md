---
status: pending
---

# Instruction: Publier une règle Kilo sans perdre sa configuration

## Architecture projection

> Arbre des fichiers finaux. ✅ créer · ✏️ modifier · aucune suppression.
> Les chemins conditionnels sont résolus à l’étape de préflight, jamais créés en doublon.

```txt
.
✏️ plugins/aidd-context/skills/05-rule-generate/SKILL.md
✏️ plugins/aidd-context/skills/05-rule-generate/actions/01-capture-rule.md
✏️ plugins/aidd-context/skills/05-rule-generate/actions/02-write-rule.md
✏️ plugins/aidd-context/skills/05-rule-generate/actions/03-validate.md
✏️ plugins/aidd-context/skills/05-rule-generate/references/tool-paths.md
✏️ plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs (base fournie par #979)
✅ plugins/aidd-context/skills/05-rule-generate/scripts/kilo-config.cjs
✏️ scripts/__tests__/rule-generation.test.js (fourni par #979, revalider après intégration)
✅ scripts/__tests__/kilo-rule-publication.test.js
✅ scripts/__tests__/fixtures/context-generation/kilo-config/
✏️ plugins/aidd-context/README.md
```

## User Journey

```mermaid
flowchart TD
  A[Demande et cibles confirmees] --> B[Preflight du contrat]
  B --> C[Resultat de la phase]
  C --> D[Verification observable et documentation]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Preparer fixture et baseline => projet isole: 5: system
  section Happy path
    Règle confirmée et config choisie => publication native puis chargement par Kilo: 5: cli
    Relancer action identique => resultat stable: 5: cli
  section Edge case - refus
    Deux propriétaires ou config invalide => demande ou refus sans écritures: 1: cli
  section Teardown
    Nettoyer projet et processus => baseline restauree: 5: system
```

## Tasks to do

### `1)` Aligner le propriétaire des règles

> Aligner le propriétaire des règles.

1. Précondition bloquante de cette phase : base de publication #979 disponible/intégrée et head revalidé, ou plan amendé explicitement. Lire tous les nouveaux contrats/tests pertinents et conserver les sorties non Kilo de cette base. Si #979 reste Draft, demander une décision explicite avant toute implémentation dépendante, sans attendre pour la phase 1. Ne pas construire un second writer. Ajouter Kilo au writer autonome, module local au skill sans import du CLI ni dependency implicite du checkout ; résoudre depuis SKILL.md livré.

### `2)` Sélection de configuration observable

> Sélection de configuration observable.

1. Avant toute écriture, inventorier les quatre fichiers projet ; zéro => .kilo/kilo.jsonc, unique => ce fichier, plusieurs => propriétaire unique de l’entrée exacte, sinon choix explicite. Plusieurs propriétaires sont ambigus. Afficher .kilo avant racine ; vérifier ordre à priorité égale sur 7.8.8 avant de documenter un ordre total. Annulation ne crée rien. Lire et valider toutes les configurations pertinentes à la sécurité de publication, sans hériter du refus dual-config CLI.

### `3)` Publication sans perte

> Publication sans perte.

1. Ajouter .kilo/rules/category/slug.md et son chemin exact relatif à instructions. Éditer les tokens JSONC sans sérialisation globale ; conserver commentaires, trailing commas, doublons, ordre et octets non concernés. Si entrée déjà présente, ne pas ajouter de doublon AIDD supplémentaire. Préflight source/config/règle et toutes cibles choisies, stage tous résultats avant publication, détecter conflit entre lecture et mutation. Restaurer sur erreur d’écriture couverte et prouver l’absence d’état partiel ; ne pas appeler une série de rename une transaction globale. Limiter la solution aux publications concernées, sans moteur transactionnel générique ; documenter les interruptions brutales et pannes machine hors garantie.

### `4)` Tests et documentation de publication

> Tests et documentation de publication.

1. Tests rouges avec filesystem réel et skill copié hors checkout/ESM/sans aidd, réutiliser tests writer de #979. Oracles hashes de tout projet avant/après erreur, comparaison byte ranges et mtime seconde exécution ; mutations doublon/order et validation tardive. Tester règle chargée par vrai Kilo avec contrôle négatif sans instructions. Documentation sources/date, fichier choisi, config-backed et limites exactes.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 3 | Règle canonique Kilo et chemin instructions exact existent ; Kilo charge le corps ; dossier seul ne suffit pas. |
| 2 | Aucun choix implicite en ambiguïté ; propriétaire unique réutilisé, annulation ne crée aucun fichier. |
| 3 | JSON/JSONC gardent doublons, ordre, commentaires, trailing commas et format hors insertion ; second passage byte-identique. |
| 3 | Configuration invalide ou cible dangereuse, y compris dernier fichier d’un fan-out, ne laisse aucun changement ; erreurs de publication testées ne laissent ni règle orpheline ni référence cassée. |
| 4 | Les publications Claude/Cursor/Copilot et partagées Codex/OpenCode du writer retenu gardent leurs contrats et les blocs de mémoire. |
