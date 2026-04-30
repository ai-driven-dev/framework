# AIDD Framework — Architecture cible (skills-first)

> Migration de l'architecture commands-first vers skills-first portable (Claude Code, Cursor, Copilot, Codex, OpenCode).
> **Ce fichier fait foi.** Toute future décision se prend en regardant l'arbre ci-dessous.

---

## Principes directeurs

1. **Skills-first** : la skill est l'atome. Plus de `commands/`, plus de `behaviors/`. Une skill = `<plugin>/skills/<name>/SKILL.md` + `actions/` + `assets/` + `evals/` + `references/` + `scripts/` (optionnel).
2. **4 plugins** : `aidd-context` (connaissance), `aidd-dev` (transformation code), `aidd-vcs` (artefacts git/release), `aidd-pm` (product management).
3. **Frontière dure framework / projet client** :
   - Framework = livré, versionné, immuable côté client.
   - Projet client = `aidd_docs/`, mutable, propre au repo. **Dans un monorepo, chaque sous-dossier (backend/, frontend/, mobile/...) peut avoir son propre `aidd_docs/`** — pas besoin de splitter dans `memory/`.
   - `AGENTS.md` du projet = router universel (déjà standard ouvert).
4. **Tout au plus proche des skills**. Pas de `core/`. Templates, conventions, principes : chacun vit dans le plugin ou la skill qui l'utilise.
5. **Test du livrable** :
   - Connaissance générale → `aidd-context`
   - Code ou plan d'implémentation → `aidd-dev`
   - Artefact externe (commit, PR, tag, issue) → `aidd-vcs`
   - Spec produit, user story, ticket → `aidd-pm`
6. **Numérotation des actions** : locale à la skill, simple. `01-`, `02-`, `03-`. Cohérent avec `generate-skill/` actuel.
   - Quand une skill fusionne des sujets hétérogènes (ex : `context-generate` fusionne rules + agents + skills), on **sous-catégorise les actions et les assets** en sous-dossiers thématiques.
7. **Migration par étapes** :
   - **v1 = migration 1:1** : chaque commande devient UNE action numérotée dans la skill parente.
   - **v2 = refactoring petit à petit** : on identifie les patterns communs, on factorise.

---

## Structure standard d'une skill AIDD

Basée sur `skills/generate-skill/` actuel (la référence) :

```
<skill>/
├── SKILL.md             # orchestrateur
├── actions/             # actions atomiques numérotées (01-, 02-, ...)
├── assets/              # templates propres à la skill
├── evals/               # tests TDD (vide en v1)
├── references/          # docs on-demand (conventions, formats)
└── scripts/             # validateurs (optionnel — surtout pour les skills méta)
```

Les fichiers vides ne sont pas listés dans l'arbre ci-dessous (notamment `evals/scenarios.json` partout sauf pour `[1.3] context-generate` qui hérite du contenu existant).

---

## Décisions résolues

- **D1.** Agents dans `aidd-dev/agents/`. Renommage et restructuration finale plus tard (Alex gère).
- **D2.** Doublon command/skill challenge : la skill gagne.
- **D3.** `challenge` + `clarity` fusionnés en `[1.5] challenge`.
- **D4.** Naming : `aidd-context / aidd-dev / aidd-vcs / aidd-pm`.
- **D5.** `for-sure` dans `aidd-dev`.
- **D6.** `ticket-info` dans `aidd-pm`.
- **D7.** `aidd-ops` : pas créé en v1, à réserver pour plus tard.
- **D8.** `[4.3] prd` reste une skill.
- **D9.** Numérotation `01-` locale à la skill.
- **D10.** `aidd-pm` marqué comme "release candidate" — à valider après v1.
- **D11.** `auto-accept` devient une action de `[2.8] for-sure` (pas de dossier `behaviors/`).
- **D12.** `golden-principles.md` dans `[1.1] project-init/assets/` (template copié au projet client).
- **D13.** `[2.0] sdlc` (skill 0, en tête de aidd-dev) — orchestrateur du cycle complet.
- **D14.** `[2.3] audit` skill à part entière (sortie de refactor).
- **D15.** `[1.8] discovery` ajouté à aidd-context.
- **D16.** Agents : minimaliste (debug + autonomous dans aidd-dev). Pas un par plugin.
- **D17.** `issue-reflect` intégré comme action `03-reflect-issue.md` de `[2.7] debug` (pas une skill séparée).
- **D18.** `adr-template.md` + `decision-template.md` dans `[1.7] learn/assets/` (pas dans plan).
- **D19.** `02-implement-from-design.md` supprimé du sdlc (pas logique).
- **D20.** `aidd_docs/` étendu à **4 dossiers** : `memory/`, `stack/` (NEW), `workflows/` (NEW), `rules/`. (Plus de `domain/` — voir D25.)
- **D21.** `memory/` contient `frontend/` et `backend/` comme sous-dossiers (au lieu de l'ancien `internal/`). Plus de concept memory interne/externe.
- **D22.** Chaque dossier de `aidd_docs/` contient un `README.md` (guide type) qui explique : quoi, qui le lit, comment maintenir.
- **D23.** Tous les templates regroupés dans `[1.1] project-init/assets/templates/` (sous-dossier unique pour la maintenance).
- **D24.** `frontend/` et `backend/` sont des sous-dossiers de `memory/` (pas au niveau templates/). Copiés si le projet a un module concerné.
- **D25.** `domain/` supprimé — tout ce qui est métier (ubiquitous-language, business-rules, bounded-contexts) va dans `memory/` selon le besoin du dev.
- **D26.** `rules/` côté projet client suit la **structure existante** : 10 dossiers numérotés (`00-architecture/` à `09-other/`), vides au départ. Convention de naming des fichiers à l'intérieur : `1-<nom>.md`. Cette structure est **générée par l'action `02-init-skeleton-rules.md`** de `[1.1] project-init` (pas de templates statiques dans assets/).

---

## Notes pour v2 (à ne pas oublier)

- **Hooks par plugin** : `<plugin>/hooks/hooks.json` pour réagir aux événements (PreCommit, PostEdit…). Très puissant — transforme le framework en OS qui pilote le flow. Ex : `aidd-vcs` → hook `PostCommit` propose `pull-request`. `aidd-dev` → hook `PostEdit` suggère `tests-write` si pas de test associé.
- **MCP servers par plugin** : splitter `framework/config/mcp.json` actuel en `<plugin>/.mcp.json`. Ex : `aidd-vcs/.mcp.json` (GitHub/GitLab), `aidd-pm/.mcp.json` (Notion/Linear/Jira).
- **Workflow skills** au-delà de `[2.0] sdlc` : `bug-fix-workflow`, `release-workflow`, etc. selon usage.
- **Skill versioning** individuel (pas juste plugin-level).
- **`When NOT to use`** dans chaque SKILL.md (anti-pattern explicite).
- **`[2.0] sdlc` chaining réel** : actions qui invoquent les autres skills (plan, test, review, commit, PR) au lieu d'une simple juxtaposition.
- **Génération de skill depuis workflow markdown** : `[1.3] context-generate` lit `aidd_docs/workflows/<workflow>.md` → génère une skill exécutable.

---

## Architecture cible

### Côté framework

```
aidd-framework/
│
└── plugins/
    │
    ├── aidd-context/                              🧠 produit de la connaissance
    │   ├── .claude-plugin/
    │   │   └── plugin.json
    │   └── skills/
    │       │
    │       ├── [1.1] project-init/                ← commands/01_onboard/init.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-init.md                 # init principal (copie templates, génère AGENTS.md)
    │       │   │   └── 02-init-skeleton-rules.md  # génère la structure rules/ : 10 dossiers numérotés (00-09) vides
    │       │   ├── assets/
    │       │   │   ├── golden-principles.md       ← aidd_docs/templates/aidd/golden_principles.md
    │       │   │   ├── AGENTS.md                  (NEW — router AGENTS.md du projet client)
    │       │   │   └── templates/                 (regroupe les templates copiés à <projet>/aidd_docs/)
    │       │   │       ├── memory/                ← copié à <projet>/aidd_docs/memory/
    │       │   │       │   ├── README.md          (guide : état projet)
    │       │   │       │   ├── architecture.md
    │       │   │       │   ├── codebase_map.md
    │       │   │       │   ├── coding_assertions.md
    │       │   │       │   ├── deployment.md
    │       │   │       │   ├── project_brief.md
    │       │   │       │   ├── testing.md
    │       │   │       │   ├── vcs.md
    │       │   │       │   ├── frontend/          (templates spécifiques front — copiés si applicable)
    │       │   │       │   │   ├── browsing.md    ← aidd_docs/templates/aidd/memory/internal/browsing.md
    │       │   │       │   │   ├── design.md      ← aidd_docs/templates/aidd/memory/internal/design.md
    │       │   │       │   │   └── forms.md       ← aidd_docs/templates/aidd/memory/internal/forms.md
    │       │   │       │   └── backend/           (templates spécifiques back — copiés si applicable)
    │       │   │       │       ├── api_docs.md    ← aidd_docs/templates/aidd/memory/internal/api_docs.md
    │       │   │       │       ├── communication.md ← aidd_docs/templates/aidd/memory/internal/backend_communication.md
    │       │   │       │       └── database.md    ← aidd_docs/templates/aidd/memory/internal/database.md
    │       │   │       ├── stack/
    │       │   │       │   └── README.md          (guide : 1 fichier par techno utilisée)
    │       │   │       └── workflows/
    │       │   │           └── README.md          (guide : spec d'une future skill custom)
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [1.2] architecture-generate/       ← commands/01_onboard/generate_architecture.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-generate-architecture.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [1.3] context-generate/            ← FUSION : generate_rules + generate_agent
    │       │   ├── SKILL.md                          + generate_skill + skills/generate-skill/
    │       │   ├── actions/                          (sous-catégorisation thématique — fusion lourde)
    │       │   │   ├── rules/
    │       │   │   │   └── 01-generate-rules.md
    │       │   │   ├── agents/
    │       │   │   │   └── 01-generate-agent.md
    │       │   │   └── skills/
    │       │   │       ├── 01-capture-intent.md
    │       │   │       ├── 02-design-evals.md
    │       │   │       ├── 03-decompose.md
    │       │   │       ├── 04-draft.md
    │       │   │       ├── 05-write.md
    │       │   │       └── 06-validate.md
    │       │   ├── assets/                           (sous-catégorisation thématique)
    │       │   │   ├── rules/
    │       │   │   │   └── rule-template.md
    │       │   │   ├── agents/
    │       │   │   │   └── agent-template.md
    │       │   │   └── skills/
    │       │   │       ├── skill-template.md
    │       │   │       ├── action-template.md
    │       │   │       └── evals-template.md
    │       │   ├── evals/
    │       │   │   └── scenarios.json             ← skills/generate-skill/evals/scenarios.json
    │       │   ├── references/
    │       │   │   ├── naming-conventions.md
    │       │   │   ├── skill-vs-command.md
    │       │   │   ├── skill-structure.md         ← rules/01-standards/1-command-structure.md
    │       │   │   ├── rule-structure.md          ← rules/01-standards/1-rule-structure.md
    │       │   │   ├── rule-writing.md            ← rules/01-standards/1-rule-writing.md
    │       │   │   └── agents-coordination.md     ← aidd_docs/templates/aidd/agents_coordination.md
    │       │   └── scripts/
    │       │       ├── validate-actions.js
    │       │       ├── validate-all.js
    │       │       ├── validate-evals.js
    │       │       └── validate-skill-md.js
    │       │
    │       ├── [1.4] brainstorm/                  ← commands/02_context/brainstorm.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-brainstorm.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [1.5] challenge/                   ← FUSION : skills/challenge/ + skills/clarity/
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-challenge.md
    │       │   │   └── 02-clarity.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [1.6] mermaid/                     ← commands/07_documentation/mermaid.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-mermaid.md
    │       │   ├── evals/
    │       │   └── references/
    │       │       └── mermaid-conventions.md     ← rules/01-standards/1-mermaid.md
    │       │
    │       ├── [1.7] learn/                       ← commands/07_documentation/learn.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-learn.md
    │       │   ├── assets/
    │       │   │   ├── install-template.md        ← aidd_docs/templates/docs/INSTALL.md
    │       │   │   ├── adr-template.md            ← aidd_docs/templates/dev/adr.md
    │       │   │   └── decision-template.md       ← aidd_docs/templates/dev/decision.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       └── [1.8] discovery/                   (NEW — recherche/listing des skills disponibles)
    │           ├── SKILL.md
    │           ├── actions/
    │           │   └── 01-find-skill.md
    │           ├── evals/
    │           └── references/
    │
    ├── aidd-dev/                                  🛠️ transforme l'idée en code
    │   ├── .claude-plugin/
    │   │   └── plugin.json
    │   ├── agents/                                ← framework/agents/* (renommage à venir, géré par Alex)
    │   │   ├── alexia.md
    │   │   ├── claire.md
    │   │   ├── iris.md
    │   │   ├── kent.md
    │   │   └── martin.md
    │   └── skills/
    │       │
    │       ├── [2.0] sdlc/                        ⭐ ORCHESTRATEUR du cycle complet (skill 0)
    │       │   ├── SKILL.md                          (plan → code → test → review → commit → PR)
    │       │   ├── actions/                          ← fusion : implement + auto + projection
    │       │   │   ├── 01-implement.md            ← commands/04_code/implement.md
    │       │   │   ├── 02-auto-implement.md       ← skills/aidd-auto-implement/SKILL.md
    │       │   │   └── 03-projection.md           ← commands/04_code/run_projection.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.1] plan/                        ← commands/03_plan/plan.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-plan.md
    │       │   ├── assets/
    │       │   │   ├── plan-template.md           ← aidd_docs/templates/aidd/plan.md
    │       │   │   ├── master-plan-template.md    ← aidd_docs/templates/aidd/master_plan.md
    │       │   │   ├── spec-template.md           ← aidd_docs/templates/aidd/spec.md
    │       │   │   └── tech-choice-template.md    ← aidd_docs/templates/dev/tech_choice.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.2] assert/                      ← FUSION : assert + assert_architecture + assert_frontend
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-assert.md               ← commands/04_code/assert.md
    │       │   │   ├── 02-assert-architecture.md  ← commands/04_code/assert_architecture.md
    │       │   │   └── 03-assert-frontend.md      ← commands/04_code/assert_frontend.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.3] audit/                       (skill à part entière)
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-audit.md                ← commands/09_refactor/audit.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.4] review/                      ← FUSION : review_code + review_functional
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-review-code.md          ← commands/05_review/review_code.md
    │       │   │   └── 02-review-functional.md    ← commands/05_review/review_functional.md
    │       │   ├── assets/
    │       │   │   ├── code-review-template.md    ← aidd_docs/templates/dev/code_review.md
    │       │   │   └── review-template.md         ← aidd_docs/templates/dev/review_code.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.5] test/                        ← FUSION : test + test_journey
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-test.md                 ← commands/06_tests/test.md
    │       │   │   └── 02-test-journey.md         ← commands/06_tests/test_journey.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.6] refactor/                    ← FUSION : performance + security (audit sorti)
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-performance.md          ← commands/09_refactor/performance.md
    │       │   │   └── 02-security.md             ← commands/09_refactor/security_refactor.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [2.7] debug/                       ← FUSION : debug + reproduce + reflect_issue ⭐
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   ├── 01-reproduce.md            ← commands/10_maintenance/reproduce.md
    │       │   │   ├── 02-debug.md                ← commands/10_maintenance/debug.md
    │       │   │   └── 03-reflect-issue.md        ← commands/10_maintenance/reflect_issue.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       └── [2.8] for-sure/                    ← FUSION : skills/for-sure/ + auto_accept
    │           ├── SKILL.md
    │           ├── actions/
    │           │   ├── 01-init-tracking.md        ← skills/for-sure/sub-actions/01-init-tracking.md
    │           │   ├── 02-auto-accept.md          ← commands/00_behavior/auto_accept.md
    │           │   └── 03-autonomous-loop.md      ← skills/for-sure/sub-actions/02-autonomous-loop.md
    │           ├── assets/
    │           │   └── tracking-template.md       ← skills/for-sure/references/tracking-template.md
    │           ├── evals/
    │           └── references/
    │
    ├── aidd-vcs/                                  🚢 produit les artefacts externes
    │   ├── .claude-plugin/
    │   │   └── plugin.json
    │   └── skills/
    │       │
    │       ├── [3.1] commit/                      ← commands/08_deploy/commit.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-commit.md
    │       │   ├── assets/
    │       │   │   └── commit-template.md         ← aidd_docs/templates/vcs/commit.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [3.2] pull-request/                ← commands/08_deploy/create_request.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-create-pull-request.md
    │       │   ├── assets/
    │       │   │   ├── pr-template.md             ← aidd_docs/templates/vcs/pull_request.md
    │       │   │   ├── branch-template.md         ← aidd_docs/templates/vcs/branch.md
    │       │   │   ├── contributing-template.md   ← aidd_docs/templates/vcs/CONTRIBUTING.md
    │       │   │   └── readme-template.md         ← aidd_docs/templates/vcs/README.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       ├── [3.3] release-tag/                 ← commands/08_deploy/tag.md
    │       │   ├── SKILL.md
    │       │   ├── actions/
    │       │   │   └── 01-tag.md
    │       │   ├── assets/
    │       │   │   └── release-template.md        ← aidd_docs/templates/vcs/release.md
    │       │   ├── evals/
    │       │   └── references/
    │       │
    │       └── [3.4] issue-create/                ← commands/10_maintenance/new_issue.md
    │           ├── SKILL.md
    │           ├── actions/
    │           │   └── 01-new-issue.md
    │           ├── assets/
    │           │   └── issue-template.md          ← aidd_docs/templates/vcs/issue.md
    │           ├── evals/
    │           └── references/
    │
    └── aidd-pm/                                   📋 product management (release candidate)
        ├── .claude-plugin/
        │   └── plugin.json
        └── skills/
            │
            ├── [4.1] ticket-info/                 ← commands/02_context/ticket_info.md
            │   ├── SKILL.md
            │   ├── actions/
            │   │   └── 01-ticket-info.md
            │   ├── evals/
            │   └── references/
            │
            ├── [4.2] user-stories-create/         ← commands/02_context/create_user_stories.md
            │   ├── SKILL.md
            │   ├── actions/
            │   │   └── 01-create-user-stories.md
            │   ├── assets/
            │   │   └── user-story-template.md     ← aidd_docs/templates/pm/user_story.md
            │   ├── evals/
            │   └── references/
            │
            └── [4.3] prd/                         (specs PRD + templates de gestion projet)
                ├── SKILL.md
                ├── actions/
                │   └── 01-prd.md
                ├── assets/
                │   ├── prd-template.md            ← aidd_docs/templates/pm/prd.md
                │   ├── status-template.md         ← aidd_docs/templates/aidd/status.md
                │   └── task-template.md           ← aidd_docs/templates/aidd/task.md
                ├── evals/
                └── references/
```

### Côté projet client (après `project-init`)

```
<projet-client>/
│
├── AGENTS.md                                       (router universel — copié depuis [1.1] project-init/assets/AGENTS.md)
│
└── aidd_docs/                                      (copié depuis [1.1] project-init/assets/, mutable)
    │
    ├── golden-principles.md                        ← copié depuis assets/golden-principles.md
    │
    ├── memory/                                     # ÉTAT du projet (copié depuis assets/templates/memory/)
    │   ├── README.md
    │   ├── architecture.md
    │   ├── codebase_map.md
    │   ├── coding_assertions.md
    │   ├── deployment.md
    │   ├── project_brief.md
    │   ├── testing.md
    │   ├── vcs.md
    │   ├── frontend/                               # copié si projet a un module front
    │   │   ├── browsing.md
    │   │   ├── design.md
    │   │   └── forms.md
    │   └── backend/                                # copié si projet a un module back
    │       ├── api_docs.md
    │       ├── communication.md
    │       └── database.md
    │
    ├── stack/                                      # IMPLÉMENTATION par techno
    │   ├── README.md
    │   ├── nextjs.md                               # ex : "Comment on utilise Next.js dans CE projet"
    │   └── <techno>.md                             # ajouté au fil du projet
    │
    ├── workflows/                                  # RECETTES procédurales (markdown)
    │   ├── README.md
    │   ├── add-backend-entity.md                   # ex : interface + validation + repo + service + tests + doc
    │   └── <workflow>.md                           # ajouté au fil du projet
    │
    ├── rules/                                      # CONVENTIONS de code (structure générée par 02-init-skeleton-rules)
    │   ├── 00-architecture/                        # 10 dossiers numérotés (00-09), vides au départ
    │   ├── 01-standards/                           # convention de naming des fichiers : 1-<nom>.md
    │   ├── 02-programming-languages/
    │   ├── 03-frameworks-and-libraries/
    │   ├── 04-tooling/
    │   ├── 05-testing/
    │   ├── 06-design-patterns/
    │   ├── 07-quality/
    │   ├── 08-domain/
    │   └── 09-other/
    │
    └── tasks/                                      # tâches en cours (vide au départ)
```

---

## Récap skills numérotées

**aidd-context** (8 skills) :
1.1 project-init · 1.2 architecture-generate · 1.3 context-generate · 1.4 brainstorm · 1.5 challenge (+ clarity) · 1.6 mermaid · 1.7 learn · 1.8 discovery

**aidd-dev** (9 skills) :
2.0 sdlc ⭐ · 2.1 plan · 2.2 assert · 2.3 audit · 2.4 review · 2.5 test · 2.6 refactor · 2.7 debug (+ reflect-issue) · 2.8 for-sure (+ auto-accept)

**aidd-vcs** (4 skills) :
3.1 commit · 3.2 pull-request · 3.3 release-tag · 3.4 issue-create

**aidd-pm** (3 skills) :
4.1 ticket-info · 4.2 user-stories-create · 4.3 prd

**Total : 24 skills** dans 4 plugins.

---

## Plan de migration v1 → v2

### v1 (cette migration)

- [ ] Créer la structure `aidd-framework/plugins/` avec les 4 plugins vides
- [ ] Pour chaque skill numérotée [X.Y], créer le squelette : `SKILL.md` + `actions/` + dossiers vides
- [ ] Migrer **chaque commande** comme **1 action** dans la skill cible (1:1, contenu copié)
- [ ] Créer les nouvelles skills sans source : `[1.8] discovery`, `[2.3] audit` (extrait de refactor)
- [ ] Créer `[2.0] sdlc` (orchestrateur — actions juxtaposées en v1, chaining en v2)
- [ ] Intégrer `reflect_issue.md` comme action `03-reflect-issue.md` de `[2.7] debug`
- [ ] Copier les templates métier au plus proche : `aidd_docs/templates/{aidd,dev,vcs,pm,docs}/` → `<skill>/assets/`
  - Notes : `adr.md` + `decision.md` → `[1.7] learn/assets/` (pas plan)
- [ ] Copier les templates de mémoire dans `[1.1] project-init/assets/templates/memory/` avec **frontend/ et backend/ comme sous-dossiers** (`internal/` éclaté)
- [ ] Créer les **squelettes** des nouveaux dossiers `aidd_docs/` dans `[1.1] project-init/assets/templates/` :
  - `stack/README.md` (guide explicatif)
  - `workflows/README.md` (guide explicatif)
- [ ] Écrire l'action `02-init-skeleton-rules.md` qui génère la structure `rules/` côté client : 10 dossiers numérotés (`00-architecture/`, `01-standards/`, ..., `09-other/`)
- [ ] Copier `golden-principles.md` et créer `AGENTS.md` template dans `[1.1] project-init/assets/`
- [ ] Copier les conventions au plus proche : skill-structure, rule-structure, rule-writing, agents-coordination → `[1.3] context-generate/references/`
- [ ] Copier les agents existants dans `aidd-dev/agents/` (renommage v2 par Alex)
- [ ] Migrer `auto_accept.md` comme action `02-auto-accept.md` dans `[2.8] for-sure`
- [ ] Étendre `scripts/sync-dist.js` pour générer `dist/{claude,cursor,copilot}/` depuis la nouvelle structure plugins
- [ ] Trancher D7 (aidd-ops) et D10 (aidd-pm RC)

### v2 (refactoring petit à petit, après v1 stable)

- [ ] Identifier les patterns communs entre actions d'une même skill → factoriser
- [ ] Introduire des routeurs si besoin pour les skills multi-actions
- [ ] Écrire les `evals/scenarios.json` réels pour chaque skill
- [ ] Renommer/restructurer les agents (`alexia`, `claire`, `iris`, `kent`, `martin`)
- [ ] Réserver/créer le plugin `aidd-ops` selon usage
- [ ] **Hooks par plugin** (PreCommit, PostEdit, etc.) — gros levier
- [ ] **MCP per plugin** : splitter `framework/config/mcp.json` en `<plugin>/.mcp.json`
- [ ] **Workflow skills** au-delà de `[2.0] sdlc` (bug-fix-workflow, release-workflow…)
- [ ] **`When NOT to use`** dans chaque SKILL.md
- [ ] **`[2.0] sdlc` chaining réel** : actions qui invoquent les autres skills (plan, test, review, commit, PR)
- [ ] **Génération de skill depuis workflow markdown** : `[1.3] context-generate` lit `aidd_docs/workflows/<workflow>.md` → génère une skill exécutable
