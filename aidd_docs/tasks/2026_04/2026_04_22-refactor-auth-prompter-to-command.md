# Refactor: Auth — Prompter → command, AuthCredential value object, path constants

## Goals

1. **Prompter → command** — `AuthLoginUseCase` receives fully-resolved inputs, no I/O dependency
2. **`AuthCredential` value object** — replace `token?: string` (implicit external) with an explicit discriminated union that carries the provider name, enabling GitLab and other CLI providers
3. **Path constants** — `.aidd` and `auth.json` promoted to named constants in `AuthStorage`; `AIDD_DIR` promoted to shared domain constant used across the codebase

---

## Architecture decisions

### AuthCredential

```typescript
// src/domain/models/auth.ts (addition)
export type AuthCredential =
  | { method: "stored"; token: string }
  | { method: "external"; provider: string }  // "gh", "glab", etc.
```

Replaces `token?: string` everywhere in the auth flow. `undefined` token as implicit signal for external is gone.

`AuthConfig` gains an optional `provider` field for persistence (backward-compatible: old files without `provider` default to `"gh"`):

```typescript
export interface AuthConfig {
  version: 1;
  method: AuthMethod;
  level: AuthLevel;
  token?: string;
  provider?: string;  // only when method === "external"
  createdAt: string;
}
```

### External provider registry

`AuthProviderAdapter` replaces its single `ExternalAuthProvider` dependency with a `Map<string, ExternalAuthProvider>`. Provider selection is by name at runtime.

```typescript
constructor(
  storage: AuthStorage,
  externalProviders: Map<string, ExternalAuthProvider>,
  tokenVerifier: LoginVerifier,
  projectRoot: string
)
```

`buildAuthProvider` in the command populates the map:
```typescript
new Map([["gh", new GhCliAdapter()]])
```

Adding GitLab later: `new Map([["gh", new GhCliAdapter()], ["glab", new GlabCliAdapter()]])` — no other changes required.

### Path constants

`AuthStorage` promotes its magic strings to private static constants:
```typescript
private static readonly AIDD_DIR = ".aidd";
private static readonly AUTH_FILE = "auth.json";
```

A shared `AIDD_DIR` constant is promoted from the local `manifest-repository-adapter.ts` to `src/domain/models/paths.ts` since use-cases in the application layer also reference `.aidd` paths directly. All callers updated to import from there.

---

## Phases

### Phase 0 — Domain models

**File: `src/domain/models/auth.ts`**

Add `AuthCredential` type. Add `provider?: string` to `AuthConfig`.

```typescript
export type AuthCredential =
  | { method: "stored"; token: string }
  | { method: "external"; provider: string }

export interface AuthConfig {
  version: 1;
  method: AuthMethod;
  level: AuthLevel;
  token?: string;
  provider?: string;
  createdAt: string;
}
```

**File: `src/domain/models/paths.ts`** (new)

```typescript
export const AIDD_DIR = ".aidd";
```

All callers of the hardcoded `".aidd"` string updated to import this constant:
- `src/infrastructure/deps.ts`
- `src/infrastructure/auth/auth-storage.ts`
- `src/infrastructure/adapters/manifest-repository-adapter.ts` (remove local duplicate)
- `src/application/commands/cache.ts`
- `src/application/use-cases/memory-script-use-case.ts`
- `src/application/use-cases/adopt-use-case.ts`
- `src/application/use-cases/clean-use-case.ts`
- `src/application/use-cases/init-use-case.ts`
- `src/application/use-cases/shared/post-install-pipeline-use-case.ts`
- `src/domain/models/sync-exclusions.ts`

> `src/application/commands/clean.ts` line 39 is a display string — leave as-is.
> `src/application/use-cases/auth-login-use-case.ts` line 28 is a prompt label — will be removed in Phase 3.

---

### Phase 1 — Port: `auth-provider.ts`

Update `AuthProvider.login` signature:

```typescript
import type { AuthCredential } from "../models/auth.js";

export interface AuthProvider {
  login(credential: AuthCredential, level: AuthLevel): Promise<AuthLoginResult>;
  status(): Promise<AuthStatus>;
  logout(): Promise<AuthLogoutResult>;
}
```

---

### Phase 2 — Infrastructure

**`src/infrastructure/auth/auth-storage.ts`**

- Add private static constants:
  ```typescript
  private static readonly AIDD_DIR = ".aidd";
  private static readonly AUTH_FILE = "auth.json";
  ```
  Use them in `projectConfigPath()` and `userConfigPath()`.
  
  > Note: Once `AIDD_DIR` is imported from `domain/models/paths.ts` for `AuthStorage`, these private constants may reference the shared constant to avoid duplication — or keep them fully private if paths.ts is already used elsewhere.

- Update `SaveOptions`:
  ```typescript
  interface SaveOptions {
    credential: AuthCredential;
    level: AuthLevel;
    projectRoot: string;
  }
  ```

- Update `save()` to persist `provider` when credential is external:
  ```typescript
  async save(options: SaveOptions): Promise<void> {
    const config: AuthConfig = {
      version: 1,
      method: options.credential.method,
      level: options.level,
      createdAt: new Date().toISOString(),
      ...(options.credential.method === "stored"
        ? { token: options.credential.token }
        : { provider: options.credential.provider }),
    };
    // ...
  }
  ```

- Update `isAuthConfig` validator: `provider` is optional string, no validation needed beyond existing fields.

**`src/infrastructure/adapters/auth-provider-adapter.ts`**

Replace `ExternalAuthProvider` field with `Map<string, ExternalAuthProvider>`:

```typescript
constructor(
  private readonly storage: AuthStorage,
  private readonly externalProviders: Map<string, ExternalAuthProvider>,
  private readonly tokenVerifier: LoginVerifier,
  private readonly projectRoot: string
) {}

async login(credential: AuthCredential, level: AuthLevel): Promise<AuthLoginResult> {
  const login = credential.method === "external"
    ? await this.resolveExternalProvider(credential.provider).verify()
    : await this.tokenVerifier.verify(credential.token);
  await this.storage.save({ credential, level, projectRoot: this.projectRoot });
  return { login, level };
}

private resolveExternalProvider(provider: string): ExternalAuthProvider {
  const adapter = this.externalProviders.get(provider);
  if (!adapter) throw new AuthenticationError(`unknown external provider: ${provider}`);
  return adapter;
}

private async verifyConfig(config: AuthConfig): Promise<string> {
  if (config.method === "external") {
    return await this.resolveExternalProvider(config.provider ?? "gh").verify();
  }
  if (!config.token) throw new AuthenticationError("invalid config");
  return await this.tokenVerifier.verify(config.token);
}
```

`config.provider ?? "gh"` preserves backward compatibility with existing `auth.json` files that predate this change.

---

### Phase 3 — Application: `auth-login-use-case.ts`

Remove `Prompter`, `AuthMethod`, `InputRequiredError`. `level` becomes required. `credential` replaces `token?`.

```typescript
import type { AuthCredential, AuthLevel } from "../../domain/models/auth.js";
import type { AuthLoginResult, AuthProvider } from "../../domain/ports/auth-provider.js";

interface AuthLoginOptions {
  credential: AuthCredential;
  level: AuthLevel;
}

export class AuthLoginUseCase {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(options: AuthLoginOptions): Promise<AuthLoginResult> {
    return await this.authProvider.login(options.credential, options.level);
  }
}
```

---

### Phase 4 — Command: `auth.ts`

**`buildAuthProvider`** takes a provider map:

```typescript
function buildAuthProvider(projectRoot: string): AuthProviderAdapter {
  const storage = new AuthStorage();
  const http = new HttpClient();
  const externalProviders = new Map<string, ExternalAuthProvider>([
    ["gh", new GhCliAdapter()],
  ]);
  return new AuthProviderAdapter(storage, externalProviders, new GhTokenAdapter(http), projectRoot);
}
```

**Login action handler** — resolve level and credential before `try/catch` where possible:

Guards (before `try/catch`):
```typescript
if (cmdOptions.gh && cmdOptions.token) {
  output.error("--gh and --token are mutually exclusive.");
  process.exit(1);
}
if (!cmdOptions.gh && !cmdOptions.token && !process.stdout.isTTY) {
  output.error("Use --gh or --token <value> in non-interactive mode.");
  process.exit(1);
}
if (!cmdOptions.level && !process.stdout.isTTY) {
  output.error("Use --level <user|project> in non-interactive mode.");
  process.exit(1);
}
const rawLevel = cmdOptions.level;
if (rawLevel !== undefined && rawLevel !== "user" && rawLevel !== "project") {
  output.error("--level must be 'user' or 'project'.");
  process.exit(1);
}
```

Inside `try`:
```typescript
const prompter = new InquirerPrompterAdapter();
const level: AuthLevel = rawLevel ?? await prompter.select<AuthLevel>(...);

let credential: AuthCredential;
if (cmdOptions.gh) {
  credential = { method: "external", provider: "gh" };
} else if (cmdOptions.token) {
  credential = { method: "stored", token: cmdOptions.token };
} else {
  const wantsPat = await prompter.confirm("Do you have a Personal Access Token?");
  if (!wantsPat) {
    credential = { method: "external", provider: "gh" };
  } else {
    const token = await prompter.input("Paste your GitHub Personal Access Token:");
    if (!token) { output.error("Token cannot be empty."); process.exit(1); }
    credential = { method: "stored", token };
  }
}

const result = await new AuthLoginUseCase(buildAuthProvider(projectRoot)).execute({ credential, level });
```

Remove `SilentPrompterAdapter` import. Remove `AuthMethod` import.

---

### Phase 5 — Tests

**`tests/application/use-cases/auth-login-use-case.integration.test.ts`**

Full rewrite. Remove: `Prompter`, `SilentPrompterAdapter`, `makeTempAuthStorage`, `describe("interactive mode", ...)`.

All tests pass `credential` and `level` directly. Mock `provider.login` assertions updated to match new signature.

Surviving tests (4):
1. "calls login with PAT when stored credential is provided at user level"
2. "calls login with external credential at project level"
3. "propagates error when provider fails"
4. "fails when stored credential has invalid token (HTTP 401)"

**`tests/infrastructure/auth/auth-provider-adapter`** (if exists) — update provider construction to use Map.

**`tests/application/use-cases/auth-logout-use-case.integration.test.ts`** — update `makeProvider()` to pass Map:
```typescript
function makeProvider(): AuthProvider {
  return new AuthProviderAdapter(
    storage,
    new Map([["gh", new GhCliAdapter()]]),
    new GhTokenAdapter(new HttpClient()),
    tempDir
  );
}
```

---

### Phase 6 — Rule updates

**`.claude/rules/00-architecture/0-command-thin-wrapper.md`**

- Replace `- Prompter calls => move into the use-case` with `- Prompter calls for domain decisions (conflict resolution, strategy selection) => move into the use-case`
- Add section: commands may use `Prompter` to resolve missing CLI inputs before calling the use-case; use-case receives fully-resolved values

**`.claude/rules/06-design-patterns/6-use-case.md`**

- Constructor injection order: annotate `Prompter` as conditional — only for domain-level interaction (e.g. conflict resolution), not input collection

---

## Edge cases

| Scenario | Where handled | Resolution |
|---|---|---|
| `--gh` + `--token` both provided | Command guard | mutual exclusion error + exit(1) |
| Neither flag in non-interactive mode | Command guard | error + exit(1) |
| `--level` missing in non-interactive mode | Command guard | error + exit(1) |
| Invalid `--level` value | Command guard | error + exit(1) |
| Interactive: PAT confirmed but empty | Command action | error + exit(1) |
| Interactive: user declines PAT | Command action | `credential = { method: "external", provider: "gh" }` |
| Existing `auth.json` without `provider` field | `verifyConfig` in adapter | `config.provider ?? "gh"` fallback |
| Unknown external provider name | `resolveExternalProvider` | `AuthenticationError` |

---

## Sequencing

| Step | Files | Notes |
|------|-------|-------|
| 1 | `src/domain/models/auth.ts`, `src/domain/models/paths.ts` | Foundation — no downstream errors yet |
| 2 | All callers of `".aidd"` string | Import `AIDD_DIR` from paths.ts |
| 3 | `src/domain/ports/auth-provider.ts` | Login signature change |
| 4 | `src/infrastructure/auth/auth-storage.ts` | Constants + SaveOptions + save() |
| 5 | `src/infrastructure/adapters/auth-provider-adapter.ts` | Map + new logic — atomic with step 6 |
| 6 | `src/application/use-cases/auth-login-use-case.ts` | Remove Prompter, use credential |
| 7 | `src/application/commands/auth.ts` | Inline resolution, Map wiring |
| 8 | All test files | Update assertions |
| 9 | Rule files | Documentation |

Steps 5+6+7 must be applied atomically (TypeScript will error between them).

## Files changed

| File | Change |
|------|--------|
| `src/domain/models/auth.ts` | Add `AuthCredential`, add `provider?` to `AuthConfig` |
| `src/domain/models/paths.ts` | New — `AIDD_DIR` constant |
| `src/domain/ports/auth-provider.ts` | `login(credential, level)` |
| `src/infrastructure/auth/auth-storage.ts` | Path constants, `SaveOptions` → credential |
| `src/infrastructure/adapters/auth-provider-adapter.ts` | Map of providers, `resolveExternalProvider()` |
| `src/application/use-cases/auth-login-use-case.ts` | Remove Prompter, use `AuthCredential` |
| `src/application/commands/auth.ts` | Inline resolution, credential construction, Map |
| `src/infrastructure/deps.ts` | Import `AIDD_DIR` |
| `src/infrastructure/adapters/manifest-repository-adapter.ts` | Remove local duplicate, import `AIDD_DIR` |
| `src/application/commands/cache.ts` | Import `AIDD_DIR` |
| `src/application/use-cases/memory-script-use-case.ts` | Import `AIDD_DIR` |
| `src/application/use-cases/adopt-use-case.ts` | Import `AIDD_DIR` |
| `src/application/use-cases/clean-use-case.ts` | Import `AIDD_DIR` |
| `src/application/use-cases/init-use-case.ts` | Import `AIDD_DIR` |
| `src/application/use-cases/shared/post-install-pipeline-use-case.ts` | Import `AIDD_DIR` |
| `src/domain/models/sync-exclusions.ts` | Import `AIDD_DIR` |
| `tests/application/use-cases/auth-login-use-case.integration.test.ts` | Full rewrite |
| `tests/application/use-cases/auth-logout-use-case.integration.test.ts` | Update `makeProvider()` |
| `.claude/rules/00-architecture/0-command-thin-wrapper.md` | Update Prompter policy |
| `.claude/rules/06-design-patterns/6-use-case.md` | Annotate Prompter |
