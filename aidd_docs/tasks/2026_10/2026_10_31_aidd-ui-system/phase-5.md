---
status: pending
---

# Instruction: Platform-agnostic norm

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/
│   ├── README.md                         ✏️ platforms, versioned code links, platform tokens, code reading
│   ├── hooks/lib/                        ✏️ records, code, tokens, css, graph, history as needed
│   └── skills/01-system/                 ✏️ references, templates
└── scripts/__tests__/                    ✏️ aidd-ui tests and fixture
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | fixture with platforms web and mobile, one root each | VALID | system |
| Happy path   | a component linked on both platforms at different versions | VALID, each link's version read | cli |
| Edge case    | a link under a root of a platform the record does not list | error names the platform | cli |
| Edge case    | two links on one platform, a link above the record's version, a link without a version | each named | cli |
| Edge case    | a colour in a Markdown or JSON file under a code root | nothing reported | cli |
| Edge case    | a colour in a string of a Swift file under a code root | reported | cli |
| Happy path   | a token redefined for one platform | `tokens.css` holds its `[data-platform]` block | cli |

## Tasks to do

### `1)` Platforms on roots and records

1. `code-roots` items may be `platform=path`; required when `system.md` declares several platforms.
2. Components and screens take an optional `platforms`, a subset of the system's; absent means all.

### `2)` Versioned code links

1. `code` is one link or a list; each ends in `@<version>`, at most the record's `version`; `#Export` optional; one link per platform.
2. A link's platform is its root's, and must be among the record's platforms; a package link names its platform as `platform=package:<name>#Export@<version>` when several platforms exist.
3. `implemented-version` disappears; an assembled molecule or composition still needs no link.

### `3)` Platform token values

1. An optional `platform` modifier of the Resolver, contexts named after the system's platforms, files `platforms/<name>.json`, checked like themes.
2. `tokens.css` writes each as `[data-platform="<name>"]`; a token both a theme and a platform set is an error.

### `4)` Code reading for every techno

1. Under code roots, documents, data, images and binary files are not read.
2. Known stylesheets and scripts keep their reader; any other text file is read for colour literals in its string literals only.

### `5)` Skill and docs

1. References and templates follow; README states the forms and limits.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | a root without a platform among several is named; a record platform not in the system is named |
| 2 | each malformed link is named alone; the fixture validates with versioned links |
| 3 | a platform file redefining a base token generates its block; a token set by a theme and a platform is named |
| 4 | Markdown, JSON and images under a root give nothing; a Swift string colour gives C4 |
| 5 | the skill's templates filled still validate |
