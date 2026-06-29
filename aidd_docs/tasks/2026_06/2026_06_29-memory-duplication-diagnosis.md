# Diagnostic — duplications mémoire (skill 02-project-memory)

> Statut : diagnostic read-only. Aucun fichier de skill modifié. Ce doc = base de validation avant fix.

## Contexte

Retour Alex : la génération de mémoire produit des duplications, et Codex 5.5
n'arrive pas à l'initialiser. Deux symptômes investigués séparément.

## Symptôme A — Codex ne peut pas init (le `@`)

**Vérifié, puis rétracté en partie.**

- Le `@` n'est PAS le standard Agent Skills. Standard = chemin relatif depuis
  la racine du skill (`reference/guide.md`, lien md `[x](x)`). Le `@` = import
  CLAUDE.md. Source : docs Anthropic + agentskills.io.
- **`aidd framework build --target codex` CONVERTIT** `@../x` → `[x](../x)`
  (lien md, `@` retiré). → Codex reçoit des chemins résolvables. OK.
- **`aidd plugin install <source brute>` + `aidd ai install`** copie le `@`
  **verbatim** → non résolvable sur Codex.
- Donc : bug réel **seulement** si un user installe la source brute sur Codex.
  Inconnu : quel chemin un vrai user Codex emprunte (marketplace/build vs brut).
- Note : mes premiers `diff`/`grep` passés par rtk ont renvoyé de faux
  "identique"/"0 match". rtk non fiable pour diff/grep ici.

**Ouvert** : tracer le chemin de distribution Codex réel.

## Symptôme B — duplications (cause trouvée)

Duplication = **structurelle**, indépendante de Codex et du `@`. Trois facteurs
cumulés :

1. **Sections de templates qui se chevauchent** : le même fait (framework,
   zones du code, commandes de test…) est demandé par 2+ templates.
2. **Fill parallèle aveugle** (action `03-generate-memory`, étape 6 : "For each
   selected template, in parallel") : chaque template rempli indépendamment,
   sans voir les autres → le chevauchement devient duplication littérale,
   garantie. C'est le multiplicateur.
3. **Aucune règle "un fait, un propriétaire"** : les Transversal rules couvrent
   code→mémoire, jamais mémoire↔mémoire. Review 04 = "consistency", sans
   dominance et sautable.

## Méthode — comment trouver le niveau fin

Le grain n'est ni le fichier ni la section : c'est le **fait demandé** (chaque
`<placeholder>`).

1. Inventaire des faits : extraire chaque `<...>` de chaque template.
2. Clé canonique : étiqueter par le fait réel (framework, entry point,
   commande de test…), pas par le mot de la section.
3. Site de duplication = un fait canonique demandé par ≥2 templates.
4. Pondérer par proba de co-déclenchement (core fire toujours → core↔core
   garanti).
5. Assigner un propriétaire unique (dominance).

## Tension de design à respecter

Le design existant a une philosophie assumée : chaque fichier mémoire = un
concern **auto-suffisant**, lisible seul. Un pointer mémoire↔mémoire est un
principe neuf qui se bat contre ça. On ne l'applique que quand le gain dépasse
la perte de lisibilité standalone. Re-nommer un framework (un mot) dans 2-3
fichiers coûte moins qu'un pointer : on garde la mini-dup.

## Audit single-responsibility

| Concern | Responsabilité | Verdict |
| --- | --- | --- |
| `integration` | internal + external | **double** → reframe (voir plan #3) |
| `architecture` vs `codebase-map` | shape vs layout, mais Structure≡Areas | overlap → drop Structure |
| `deployment` vs `infra` | ship/run vs provisioning, "environments" dans les 2 | overlap → scope |
| `deployment` | pipeline+env+release+monitoring | large mais cohérent (ship/run) |
| `mobile`/`desktop` | incluent build&release ≡ `deployment` | overlap mineur, abandonné |
| autres (vcs, data, testing, auth, cli…) | single net | OK |

Note écosystème (hors scope) : `integration.md` est gaté par la capability
`api`. Mais consommer des services externes n'exige pas d'exposer une API. Gate
douteux → à revoir dans `capability-signals`, séparément.

## Table de dominance — réduite haute-valeur

### À appliquer (gain net)

| # | Fait | Action | Type |
| --- | --- | --- | --- |
| 2 | Zones top-level + responsabilité | `codebase-map.Areas` possède → drop `architecture.## Structure` | drop |
| 3 | Intégrations | reframe `integration` en intégrations externes (voir plan) | reframe |
| 4 | Libs de domaine | `architecture.Stack` = macro only, ne re-liste pas une lib déjà possédée par une capability | scope (inversé) |
| 8 | "Où routes définies" | `api.Style` = serveur/RPC ; `navigation.Routing` = client | scope |
| 12 | CI/CD vs provisioning | `deployment.Pipeline` = CI/CD ; `infra.Tooling` = provisioning | scope |

### Abandonnés (pointer < dup, casse l'auto-suffisance)

`#1` framework (un mot), `#5` commandes (gate vs itération, buts distincts),
`#9` authz, `#10` auth socket, `#11` environnements, `#13` release/packaging,
`#14` SDK externe.

## Le vrai multiplicateur : le fill parallèle aveugle

Même templates parfaits, le fill parallèle (`03.6`) re-écrit un même fait dans
chaque template dont le placeholder matche. **C'est ici que se gagne le gros de
la dédup.**

## Plan d'exécution

### Templates

1. `core/architecture.md` — **drop `## Structure`** (modules + entry point).
   Possédé par `codebase-map`.
2. `core/architecture.md` — **Stack, bullet 2** → "libs transversales only ;
   une lib couverte par une capability (ORM, runner, form lib) vit là-bas".
3. `api/integration.md` — **reframer en intégrations externes** (responsabilité
   unique). Le fichier mélange Internal (flux entre modules → appartient à
   `architecture.How it fits together`) + External (services tiers). Fix :
   - intro : "internal communication and external services" → "how this system
     integrates with external/third-party services" ;
   - drop `## Internal` ;
   - garder `## External services` + diagramme (carte des intégrations externes).
   Ne pas juste couper Internal (sinon fichier mal nommé à une section) — c'est
   un reframe de responsabilité.
4. `api/api.md` — **Style, bullet 1** → préfixer "Server/RPC surface" + "server
   routes".
5. `ui/navigation.md` — **Routing, bullet 1** → préfixer "Client routing" +
   "client routes".

### Actions / règles

6. `actions/03-generate-memory.md` — **étape 6** : retirer "in parallel" ;
   "For each selected template (en tenant compte des faits déjà capturés par les
   templates précédents, pour ne pas redire un fait)".
7. `SKILL.md` transversal + `actions/04-review-memory.md` étape 2 :
   - SKILL.md : "Each fact lives in exactly one memory file ; another file
     references it, never restates it." (uniquement pour les faits de la table
     réduite)
   - 04 : check "no fact duplicated across files ; si dupliqué, garder dans le
     fichier propriétaire, drop la copie."

### Validation post-édit

- `aidd framework build --target codex` passe sans erreur.
- Relire les templates touchés : chacun reste lisible seul.

### Hors scope (suivi séparé)

- Symptôme A (distribution Codex `@` brut vs build) : tracer le chemin réel.
- Gate de `integration` sous capability `api` : à revoir dans capability-signals.
