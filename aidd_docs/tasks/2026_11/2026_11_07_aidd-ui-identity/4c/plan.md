---
objective: "Sur le pilote vierge et un réel, chaque wireframe a son écran, proposé en variantes par `05-screens` ; le moteur signale un contraste sous le seuil et une zone tactile trop petite."
status: done
---

# Plan : aidd-ui 4c, écrans, contraste, zones tactiles

Source : [spec.md](../spec.md), tranche 4c et son done-when ; contrat : décision 4 (écran sans wireframe, un avertissement) et la base WCAG 2.2 AA.

## Phases

| #   | Phase | Depends on |
| --- | ----- | ---------- |
| 1   | Moteur : clé `wireframe` d'un écran, règle R19 | none |
| 2   | Moteur : contraste par thème, règle V11 | none |
| 3   | Moteur : zones tactiles, règle V12 | none |
| 4   | Skill `05-screens`, pilote, docs | 1, 2, 3 |
| 5   | Une passe pilote, `run-4c.md`, gates | 4 |

Phases 1 à 3 touchent des fichiers distincts : `records.cjs`, puis `renders.cjs` avec un module couleur neuf.

## Données réelles observées

Lues sur la copie replay d'un vrai projet, jamais recopiées dans les fixtures.

- Un render pose ses styles dans un bloc `<style>` : règles par classe et `data-*`, valeurs en `var()`.
- Une règle porte souvent `background` et `color` ensemble ; `body` pose le fond du render.
- Couleurs des tokens : hex, `rgba()`, `color(srgb r g b / a)`. Fonds translucides et `transparent` présents.
- Tailles : `height` et `min-height` en `var()` ; tokens sans unité (`40`), en `px` ou en `rem`.
- Kairos écrit `calc(var(--12) * 1px)` et porte des rôles non interactifs (`status`, `progressbar`).
- Le seul render d'écran observé (`home.html`) ne porte aucune paire couleur et fond.

## Phase 1 : écran et wireframe

- `screen` gagne la clé optionnelle `wireframe: <id>`, hors des clés requises (`records.cjs:33`), comme `code`.
- R19, avertissement : un écran sans `wireframe`.
- R19, erreur : `wireframe` nomme un id absent ou une fiche d'un autre kind.
- Rien pour un composant manquant : R6 signale déjà un `uses` inconnu (`records.cjs:114`).

Tests : un `describe("R19 wireframe of a screen")` dans `records.test.js`, modèle R18.

## Phase 2 : contraste

- Cible : le render de chaque écran, une fois par thème de `system.md` (base seule sans thème).
- Une paire : une règle du bloc `<style>` qui déclare `color` et `background` ou `background-color`.
- Valeurs résolues par `resolvedValues` (`tokens.cjs:534`), contexte du thème puis base.
- Formats lus : hex, `rgb()`/`rgba()`, `color(srgb … / a)`. Tout autre format : paire non vérifiée.
- Fond translucide ou `transparent` : composé sur le fond de `body` du même thème.
- Seuil : ratio WCAG 4.5. `opacity` ignorée.
- Sévérité : erreur, avec les deux tokens, le thème et le ratio dans le message.

Tests : un module couleur pur (parse, composition, ratio) et V11 dans `screen-renders.test.js`.

## Phase 3 : zones tactiles

- Plancher : 24 px. `system.md` le relève par plateforme : `touch-target: [mobile=44]`, lu par `platformEntries` (`code.cjs:60`).
- Plancher d'un écran : le plus haut de ses `platforms`, sinon de ceux de `system.md`, sinon 24.
- Cible : un élément interactif du body (`button`, `a`, `input`, `select`, `textarea`, `role=`), relevé par `TAG` (`renders.cjs:18`).
- Une règle le vise quand son sélecteur nomme sa balise ou une de ses classes.
- Tailles lues : `height`, `min-height`, `block-size`, `min-block-size`, résolues par `var()`.
- Unités : sans unité vaut px, `px` tel quel, `rem` fois 16.
- Sévérité : erreur, avec l'élément, la taille, le plancher et sa plateforme.

Tests : V12 dans `screen-renders.test.js`, plancher par défaut et relevé.

## Phase 4 : skill et pilote

- `05-screens`, routeur et actions sur le modèle de `04-components`.
- Il propose toujours au moins deux variantes d'écran, comparées puis tranchées par le moteur.
- Un composant manquant l'arrête : il le nomme, ne le crée pas.
- Le render d'un écran porte les styles de ce qu'il montre, sinon V11 ne vérifie rien.
- Gabarit d'écran avec `wireframe`.
- Vérifier d'abord que `compare` montre `screens/<id>.html` d'une variante et que `tokens.css` s'y résout.
- Pilote : `CHAIN`, `OWNED` (`screens/`), `ENGINE_FILES`, `REQUESTS` ; contrôle « chaque wireframe a son écran » par la clé `wireframe`.
- Tests épinglés à mettre à jour : `pilot.test.js:321`, `skill.test.js:12,15,199`.
- Docs : README du plugin, `engine.md` des skills concernés, `CATALOG.md` régénéré.

## Phase 5 : preuve

- Un pilote vierge puis un réel, une passe.
- `run-4c.md` : sortie du pilote, paires et cibles vérifiées par écran (plus de zéro sur le réel), mutations.
- Gates : suite enveloppée, `pnpm exec lefthook run pre-commit`.

## Rules

| Rule | Why it applies |
| --- | --- |
| test d'abord, chaque garde avec la mutation qui rougit son propre test | R19, V11, V12 sont des règles du moteur |
| une mutation par sorte de paire (opaque, translucide, transparente) et par unité | la composition et la conversion sont des gardes |
| aucun code pour une entrée jamais observée | autres formats de couleur, `opacity`, héritage : limites |
| fixtures aux couleurs synthétiques | jamais les valeurs d'un projet client |
| phrases de skill à douze mots au plus ; un skill ne nomme aucun autre skill | tests de structure existants |
| suite des scripts toujours enveloppée | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` |
| après chaque test CLI d'un agent, supprimer le chat | le pilote lance `claude -p` |

## Decisions

| Decision | Why |
| --- | --- |
| Le lien est une clé `wireframe` sur l'écran | les ids sont uniques entre fiches ; une clé sert à la fois R19 et le pilote |
| Contraste et zones tactiles en V11 et V12, famille des renders | ils lisent un render, comme V1 à V10 |
| Écrans seulement, pas les renders de composants | la spec vise l'écran ; un projet réel ne bloque pas sur sa dette de composants |
| Aucun parseur DOM ni bibliothèque couleur | les renders observés suffisent à la lecture par règle ; le plugin n'a aucune dépendance |
| Composition sur le fond de `body` | les variantes `ghost` et `danger` observées sont translucides ; les ignorer manquerait l'échec probable |

## Accepted limits

- Pas d'héritage : une règle sans paire complète n'est pas vérifiée.
- Seuil 4.5 partout, plus strict que AA pour un grand texte.
- `opacity` ignorée, donc l'état désactivé, que WCAG exempte, n'est pas vérifié.
- Une taille non déclarée n'est pas vérifiée ; `rem` suppose une base de 16 px.
- Un sélecteur est lu par balise et classe ; ses autres filtres ne restreignent rien.
- Seuls les rôles `link`, `radio`, `switch` et `tab` font d'un élément un contrôle.
- Les brouillons sont vérifiés après `keep`, pas pendant `compare`.
- Les règles sous `@media` sont ignorées.
- V12 lit les tailles du contexte de base : un token redéfini par plateforme n'est pas vu.
- V12 signale une fois par règle, pas par élément.
- Les tokens qui ne génèrent pas de feuille ne sont pas lus : T1 à T10 les nomment déjà.
