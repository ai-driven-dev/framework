# Observation runtime de la phase 2

Le 12 octobre 2026, Kilo CLI 7.8.8 a été exécuté sous Linux dans un projet temporaire isolé. Avec la règle `.kilo/rules/01-standards/1-naming.md` et son chemin exact dans `instructions`, la réponse contenait `COBALT_914`. Pour le contrôle négatif, le même fichier règle est resté présent ; seule la propriété `instructions` a été retirée et une nouvelle session a été lancée. La réponse négative demandait le contexte et ne contenait pas le marqueur. Les deux processus ont terminé avec le code 0 et le coût rapporté était 0.

Cette observation vérifie le chargement du corps de cette règle dans cette configuration et cette version de Kilo. Elle ne provient pas d’un test unitaire, ne couvre pas toutes les versions/modèles/plateformes et ne prouve rien sur Claude Code. Les sorties publiées sont expurgées des identifiants de session, message, requête et fournisseur ; les captures brutes ont été conservées hors de l’arbre publiable sans modification.

## Entrées conservées

- [Configuration positive](runtime-corrections-positive-config.jsonc)
- [Configuration négative](runtime-corrections-negative-config.jsonc)
- [Requête exacte du writer](runtime-request.json)
- [Règle de la fixture](runtime-corrections-rule.md)
- [Sortie positive expurgée](runtime-positive-redacted.jsonl)
- [Sortie négative expurgée](runtime-negative-redacted.jsonl)

La configuration positive référence le chemin exact de la règle ; la négative conserve `$schema` et omet uniquement `instructions`. La règle contient le marqueur de vérification `COBALT_914`. Le journal brut n’est pas un artefact de publication.

## Reproduction

Avec Kilo 7.8.8 installé, définir les chemins de fixture et résoudre `$WRITER` depuis le skill installé :

```sh
EVIDENCE=/path/to/phase-2/evidence
FIXTURE_POSITIVE="$(mktemp -d)"
FIXTURE_NEGATIVE="$(mktemp -d)"
REQUEST="$EVIDENCE/runtime-request.json"
POSITIVE_CONFIG="$EVIDENCE/runtime-corrections-positive-config.jsonc"
FIXTURE_NEGATIVE_CONFIG="$EVIDENCE/runtime-corrections-negative-config.jsonc"
# WRITER = chemin absolu de scripts/write-rule.cjs dans le skill installé
node "$WRITER" --project "$FIXTURE_POSITIVE" --tools kilo --input "$REQUEST"
mkdir -p "$FIXTURE_NEGATIVE/.kilo"
cp "$POSITIVE_CONFIG" "$FIXTURE_POSITIVE/.kilo/kilo.jsonc"
cp -a "$FIXTURE_POSITIVE/.kilo/rules" "$FIXTURE_NEGATIVE/.kilo/"
cp "$FIXTURE_NEGATIVE_CONFIG" "$FIXTURE_NEGATIVE/.kilo/kilo.jsonc"
```

La requête exacte est conservée dans [runtime-request.json](runtime-request.json). `$FIXTURE_NEGATIVE_CONFIG` désigne la configuration négative archivée ; la positive est celle produite par le writer. Avec XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_STATE_HOME et XDG_CACHE_HOME isolés différemment par session, lancer :

```sh
kilo --version
env XDG_CONFIG_HOME="$(mktemp -d)" XDG_DATA_HOME="$(mktemp -d)" XDG_STATE_HOME="$(mktemp -d)" XDG_CACHE_HOME="$(mktemp -d)" \
  kilo run --pure --dir "$FIXTURE_POSITIVE" --model kilo/cohere/north-mini-code:free --format json \
  'What is the exact answer to the verification question? Answer only that token.'
env XDG_CONFIG_HOME="$(mktemp -d)" XDG_DATA_HOME="$(mktemp -d)" XDG_STATE_HOME="$(mktemp -d)" XDG_CACHE_HOME="$(mktemp -d)" \
  kilo run --pure --dir "$FIXTURE_NEGATIVE" --model kilo/cohere/north-mini-code:free --format json \
  'What is the exact answer to the verification question? Answer only that token.'
```

Les commandes d’exécution utilisent des chemins symboliques locaux ; aucun chemin temporaire personnel n’est requis. La disponibilité du service et du modèle peut changer.

Une tentative initiale sans accès réseau a expiré sur l’appel de service Kilo. Les exécutions rapportées ont ensuite réussi avec accès réseau disponible ; une nouvelle exécution dépend de l’accès au service et de la disponibilité du modèle nommé.
