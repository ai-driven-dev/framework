# Decision: Typed exceptions split across three layers

| Field   | Value                                       |
| ------- | ------------------------------------------- |
| ID      | DEC-018                                     |
| Date    | 2026-04-08                                  |
| Feature | error-handling                               |
| Status  | Accepted                                    |

## Context

All errors were `throw new Error("user-facing string")` — no type identity, no ability to match behavior per error kind, infrastructure details leaking through adapters into commands.

## Decision

Typed exceptions in three layers following hexagonal dependency direction:

- **Domain** (`src/domain/errors.ts`): `AuthenticationError`, `ManifestValidationError`, `ToolValidationError`, `McpConfigError`, `FrameworkResolutionError`, `PackageManagerError`, `UpdateError`, `NoFrameworkSourceError`, `ConfigConflictError`
- **Application** (`src/application/errors.ts`): `NotAuthenticatedError`, `AlreadyInitializedError`, `InputRequiredError`, `ToolNotInstalledError`, `NoManifestError`, `AiddFilesDetectedError`, `AdoptRequiresVersionError`
- **Infrastructure** (`src/infrastructure/errors.ts`): `HttpError`, `HttpNotFoundError`, `HttpRedirectError`, `TarExtractionError`, `JsonParseError`, `AuthStorageError`, `CacheMissError`, `GhCliError`

Infrastructure errors never cross the port boundary — adapters translate to domain exceptions before throwing.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| All exceptions in domain | Simple, one file | Infra details (HttpError, GhCliError) in domain | Architecture violation |
| ErrorHandler imports infra exceptions | Handler matches all types | Application imports infrastructure | Breaks dependency direction |

## Consequences

- Zero `throw new Error("...")` in `src/`
- Adapters translate raw errors to domain exceptions (option A from brainstorm)
- `GhCliError` in infrastructure only — use-cases use `AuthenticationError("gh CLI")` instead
- `PackageManagerError` in domain — package manager is a domain concept
