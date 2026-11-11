---
objective: "Sur le pilote vierge, `02-brand` propose trois directions distinctes, comparées dans une page statique, et la retenue devient `brand.md` ; le moteur signale un jeu de variantes sans intention ou sans différence."
status: done
---

# Plan : aidd-ui 4b, variantes et marque

Source : [spec.md](../spec.md), tranche 4b, son done-when et la question ouverte ; brief [brainstorm.md](../brainstorm.md).

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Moteur : brouillons ignorés, `compare` vérifie le jeu, `keep` le tranche | [`phase-1.md`](./phase-1.md) | none |
| 2   | Moteur : `compare` écrit la page statique et le format du retour | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Skills : `02-brand` propose toujours et évolue, 03 et 04 sur demande ; pilote | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Une passe pilote, une passe navigateur, `run-4b.md`, gates | [`phase-4.md`](./phase-4.md) | 3 |

## External sources

| URL | What it settled |
| --- | --- |
| <https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker> | contexte sécurisé exigé ; activation utilisateur exigée (un clic), sinon `SecurityError` |
| `@mdn/browser-compat-data@6.0.0`, `api.Window.showSaveFilePicker` | Chrome et Edge 86+ ; Firefox et Safari : `version_added: false` |
| même source, `api.Clipboard.writeText` | Chrome 66, Firefox 63, Safari 13.1 ; dans un geste utilisateur |

## Question ouverte : la page en `file://` écrit-elle `feedback.json` ?

Sondé sur Chrome 156 avec un fichier `file://` : `isSecureContext` vrai, `origin` `"null"`, `showSaveFilePicker` et `navigator.clipboard.writeText` présents, DOM d'une iframe `srcdoc` lisible depuis la page.

- Réponse : oui sous Chromium, jamais en silence. Un clic ouvre le sélecteur d'enregistrement, nom proposé `feedback.json`. La personne choisit elle-même `drafts/<id>/` : `startIn` ne vise aucun chemin arbitraire.
- Firefox et Safari : pas de sélecteur. La page copie le retour, la personne le colle dans le chat. Le skill l'écrit tel quel dans `drafts/<id>/feedback.json` : un seul chemin de lecture.
- Pas de repli `<a download>` : il tombe dans Téléchargements, jamais dans `drafts/`.
- Non prouvé à ce stade : une écriture réelle. Elle est faite une fois en phase 4, dans Chrome.

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| regression | élevé : `load` (`project.cjs:108-119`) parcourt tout `aidd_docs/ui/` sauf `showcase` ; un `brand.md` sous `drafts/brand/a/` lèverait R2 et le hook | 1 |
| regression | moyen : deux commandes neuves cassent `help.test.js` (une entrée par commande, carte `runs` des codes de sortie), le `WHAT` de `skill.test.js:376` (`WHAT.find` rend `undefined`, la déstructuration jette) et le test des drapeaux de `cli.cjs` | 1, 3 |
| hook | moyen : `hook.cjs:23` liste par nom les commandes qui écrivent (`ENGINE_WRITES`) ; sans `keep`, les fiches qu'il écrit échappent au tour | 1 |
| collision de nom | `variants` est déjà la clé des axes d'un composant (`model.cjs:24`, `records.cjs:26`) ; le moteur parle donc de brouillons (`drafts`) et de commandes `compare` et `keep`, jamais d'une clé `variants` | 1 |
| architecture | le moteur porte seul la mécanique ; les skills écrivent les brouillons et lisent le retour. L'intention et les axes vivent dans `drafts/<id>/variants.md`, jamais dans le front matter : `keep` n'a rien à retirer d'une fiche | 1, 3 |
| runtime | page `file://`, aucun serveur, aucun écouteur réseau ; chaque variante dans une iframe `srcdoc`, isolant ses styles, son DOM pilotable depuis la page (sondé) | 2 |
| pilote | `stepBreaks` signale déjà tout fichier hors de l'ensemble d'une étape : un brouillon laissé derrière `keep` sort sans code neuf ; seul `drafts/.gitignore` rejoint `ENGINE_FILES["02-brand"]` | 3 |
| documentation | README du plugin (étape 3 et diagramme), `docs/CATALOG.md` si les actions de `02-brand` changent ; `CATALOG.md` du plugin régénéré au commit | 3 |

## Rules

| Rule | Why it applies |
| --- | --- |
| test d'abord, chaque garde avec la mutation qui rougit son propre test | `compare`, `keep` et le saut de `drafts/` sont des gardes du moteur |
| gardes pour les règles du moteur seulement | rien sur la formulation ni sur un choix du modèle |
| phrases de skill et de `help` à douze mots au plus | `skill.test.js` et `help.test.js` |
| actions d'intention : ni commande, ni drapeau, ni bloc de code | `engine.md` porte les commandes ; `help` porte le comment |
| un skill ne nomme aucun autre skill, ne lie rien hors de son dossier, aucun fichier de référence en double | tests de structure existants |
| aucun code pour une entrée jamais observée | les cas non vus s'écrivent en limites |
| aucun écouteur réseau | la page s'ouvre en `file://` |
| suite des scripts toujours enveloppée | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` |
| après chaque test CLI d'un agent, supprimer le chat | le pilote lance `claude -p` |

## Decisions

| Decision | Why |
| --- | --- |
| Un jeu vit dans `aidd_docs/ui/drafts/<id>/` : `variants.md` (une table `Variant`, `Intent`, puis une colonne par axe) et un dossier par variante, miroir de `aidd_docs/ui/` | la table déclare axes et valeurs d'un coup ; le miroir dit où chaque fichier atterrit sans rien déclarer |
| Différence réelle : chaque paire diffère sur au moins un axe déclaré, et aucun dossier de variante n'est identique octet pour octet à un autre | une seule règle mécanique, que le done-when « sans différence est signalé » vise |
| `compare <id>` vérifie le jeu, écrit `drafts/.gitignore` (`*`) puis la page `drafts/<id>/compare.html` | brouillons ignorés sans toucher le `.gitignore` du projet, donc code intact |
| `keep <id> <variante>` revérifie, copie le dossier retenu dans `aidd_docs/ui/` sauf `preview.html`, puis efface `drafts/<id>/` | « la retenue devient une fiche, les autres partent » ; la page et le retour partent avec |
| Une variante de marque porte `brand.md` et un `preview.html` stylé en ligne, jamais promu | une marque est du texte ; l'aperçu rend la direction visible avant que des tokens existent |
| La page incorpore chaque `.html` d'une variante en `srcdoc`, `tokens.css` en ligne quand il existe ; thèmes lus dans `system.md`, états dans les `data-state` trouvés | isolation des styles, DOM pilotable en `file://`, aucune donnée inventée |
| Le format du retour est écrit une fois dans le moteur : une fonction pure, testée en node, sérialisée dans la page, et décrite dans `help compare` | « le moteur définit un seul format pour les deux » |
| L'évolution de la marque arrive en 4b : `02-brand` ne s'arrête plus sur un `brand.md` existant | le contrat donne à chaque auteur naissance et évolution ; 4a l'a reportée aux variantes |
| `03-foundations` et `04-components` gardent leurs actions ; une étape de `02-write` propose des variantes sur demande | sur demande seulement ; le moins de surface |

## Accepted limits

- La page n'écrit `feedback.json` que sous Chromium, après un clic, la personne choisissant le dossier ; ailleurs, copier-coller seul.
- Firefox et Safari : établis par les données de compatibilité MDN, non sondés sur cette machine.
- Une marque reste sans version : aucune ligne `history.md`, les fondations ne passent pas en retard ; l'auteur les reprend à la demande.
- Une variante de fondations montre sa direction par son `preview.html` stylé en ligne : le moteur ne génère pas de `tokens.css` par variante.
- Variantes de `03-foundations` et `04-components` : couvertes par les tests du moteur, non pilotées ; le done-when ne vise que la marque.
- Un dossier de variante sans ligne dans `variants.md` n'est pas signalé : `keep` l'efface avec le reste.
- La différence est déclarée ou binaire : deux variantes au fond semblables mais écrites autrement passent.
- Le pilote ne peut ouvrir la page : « comparées dans la page » est prouvé par la passe navigateur de la phase 4.
