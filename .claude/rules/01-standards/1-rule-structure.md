---
paths:
  - ".claude/rules/**/*.md"
  - ".claude/rules/**/*.mdc"
---

# Rule file structure

## File naming

Format: `#-rule-name[@version][-specificity].<ext>`

- `#` : Number based on category (00-09)
- `-rule-name` : Slugified short rule name
- `@version` : Optional framework/lib version
- `-specificity` : Optional sub-part
- `.<ext>` : Extension (see ide-mapping rule)

## Directory structure

Output rules following ide-mapping conventions for path and structure.

| #    | Category                   | Content                     | Examples                        |
| ---- | -------------------------- | --------------------------- | ------------------------------- |
| `00` | `architecture`             | System-level code patterns  | Clean, Hexagonal, API design    |
| `01` | `standards`                | Code style, naming          | camelCase, imports              |
| `02` | `programming-languages`    | Language-specific rules     | TypeScript strict mode          |
| `03` | `frameworks-and-libraries` | Framework/lib code patterns | React hooks, Prisma, Express    |
| `04` | `tooling`                  | Tool/infra configuration    | ESLint, Docker, Webpack, CI/CD  |
| `05` | `testing`                  | Test code patterns          | Structure, fixtures, mocking    |
| `06` | `design-patterns`          | Code design patterns        | Repository, Factory, Observer   |
| `07` | `quality`                  | Perf & security in code     | Caching, auth patterns, headers |
| `08` | `domain`                   | Business logic code         | Validation, entities, DTOs      |
| `09` | `other`                    | Miscellaneous               | Edge cases                      |

## Example

Naming pattern for React rules in `03-frameworks-and-libraries` category:

- `3-react`
- `3-react@18`
- `3-react@19`
- `3-react@19-hooks`
- `3-react@19.1-hooks`
