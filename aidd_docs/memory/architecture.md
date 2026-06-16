# Architecture

## Language/Framework

```json
{
  "runtime": "Node.js 20",
  "primary_format": "Markdown (skills, agents, rules, memory)",
  "package_manager": "pnpm",
  "devDependencies": ["@commitlint/cli", "@commitlint/config-conventional", "lefthook"]
}
```

```mermaid
flowchart LR
    Marketplace[".claude-plugin/marketplace.json"] --> Plugins["plugins/"]
    Plugins --> Context["aidd-context"]
    Plugins --> Dev["aidd-dev"]
    Plugins --> VCS["aidd-vcs"]
    Plugins --> PM["aidd-pm"]
    Plugins --> Refine["aidd-refine"]
    Plugins --> Orchestrator["aidd-orchestrator"]
    CLI["@ai-driven-dev/cli"] -- installs --> Plugins
```

### Naming Conventions

- **Plugins**: `aidd-<domain>` — kebab-case
- **Skills**: `NN-slug/SKILL.md` — numbered prefix + kebab-case slug
- **Actions**: `NN-action-name.md` — numbered, kebab-case
- **Agents**: `name.md` — flat, kebab-case
- **Rules**: `N-name.md` — numbered, kebab-case
- **Memory files**: `topic.md` — kebab-case noun

## Plugin Structure

Each plugin follows this layout:

```mermaid
flowchart TD
    Plugin["plugins/aidd-X/"] --> ClaudePlugin[".claude-plugin/plugin.json"]
    Plugin --> Skills["skills/NN-name/"]
    Plugin --> Agents["agents/"]
    Skills --> SkillMd["SKILL.md"]
    Skills --> Actions["actions/NN-action.md"]
    Skills --> Assets["assets/"]
```

## Services Communication

### CLI to Marketplace

```mermaid
flowchart LR
    User["Developer"] -- "aidd plugin add" --> CLI["@ai-driven-dev/cli"]
    CLI -- reads --> Marketplace[".claude-plugin/marketplace.json"]
    CLI -- copies --> TargetRepo["target repo's AI tool dir"]
```

### External Services

#### GitHub Package Registry

```mermaid
flowchart LR
    CI["GitHub Actions"] -- publishes --> NPM["npm.pkg.github.com/@ai-driven-dev/cli"]
    CI -- creates --> Release["GitHub Release + assets"]
    BuildScript["scripts/build-dist.sh"] -- generates --> Dist["plugin dist archives"]
```
