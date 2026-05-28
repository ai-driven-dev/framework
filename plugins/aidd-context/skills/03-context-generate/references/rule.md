# Rule authoring

Conventions for every rule file the `rules` sub-flow produces. These govern the CLIENT artifact (the rule written into the user's workspace), not this generator's own files. Frontmatter shape, file extension, glob syntax, and on-disk location are tool-specific: see `@ai-mapping.md`.

## File naming

Format: `#-rule-name[@version][-specificity].<ext>`

- `#` : Number based on category (00-09)
- `-rule-name` : Slugified short rule name
- `@version` : Optional framework/lib version
- `-specificity` : Optional sub-part
- `.<ext>` : Extension (tool-specific, see `@ai-mapping.md`)

## Directory structure

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

## Category selection rubric

Pick the category with the most-specific match. Walk this list top to bottom and stop at the first hit.

1. Targets a specific framework / library (React, Prisma, Tailwind, Express, ...) -> `03-frameworks-and-libraries`.
2. Targets a specific programming-language syntax (TypeScript strict mode, JS quote style, Python f-strings, Go error handling) -> `02-programming-languages`.
3. Language-agnostic style or naming convention (camelCase, import order, line length, file headers) -> `01-standards`.
4. Project / system architecture pattern (Hexagonal, Clean, REST conventions, ports & adapters) -> `00-architecture`.
5. Tool / infra config (ESLint, Docker, Webpack, GitHub Actions) -> `04-tooling`.
6. Test code patterns -> `05-testing`.
7. Code-level design pattern (Factory, Repository) -> `06-design-patterns`.
8. Performance / security / accessibility in code -> `07-quality`.
9. Business-domain logic (entities, validation, DTOs) -> `08-domain`.
10. None of the above -> `09-other`.

The leading number of the filename slug equals the leading number of the chosen category directory (single digit, no zero-pad). All rules inside `02-programming-languages/` start with `2-`; all inside `03-frameworks-and-libraries/` start with `3-`; etc. The slug carries the category index, not a sequential counter.

Naming example for React rules in `03-frameworks-and-libraries`: `3-react`, `3-react@18`, `3-react@19`, `3-react@19-hooks`, `3-react@19.1-hooks`.

## Content format

- Bullet points only, no prose.
- 1 ultra short (3-7 words) rule per bullet.
- Remove non-essential fluff. Less is more.

## Code references

- Existing code: use the tool's include syntax (see `@ai-mapping.md`).
- Globs: format without `@`.
- Inline code: use backticks.

## Groups and examples

- Identify logical rule groups. Not needed for short rules.
- Optional: one tiny generic example per group IF NEEDED. Good code only.

## Path convention

The physical location of a rule encodes its `category` and `slug`. The category is the subdirectory; the slug is the file name (`<#-slug[@version][-specificity]>.<ext>`). Frontmatter never carries the rule path; downstream tools derive it from the file location alone.

The base directory and the file extension are tool-specific. Refer to `@ai-mapping.md` for the exact path per AI tool, including tools where rules are not supported.
