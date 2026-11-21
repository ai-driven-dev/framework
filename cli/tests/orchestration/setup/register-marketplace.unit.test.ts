import { describe, expect, it, vi } from "vitest";
import type { TokenProvider } from "../../../src/contexts/auth/contract/token-provider.js";
import type { RefreshMarketplace } from "../../../src/contexts/distribution/application/refresh-marketplace.js";
import type { RegisterFrameworkMarketplace } from "../../../src/contexts/distribution/application/register-framework-marketplace.js";
import {
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../src/contexts/distribution/contract/framework-source.js";
import type { RepositoryVisibility } from "../../../src/contexts/distribution/ports/repository-visibility.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import type { UserSourceReferences } from "../../../src/contexts/machine-claims/ports/user-source-references.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import { CatalogFetchAuthError } from "../../../src/shared/domain/errors/catalog-fetch-auth-error.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeCurrentVersion } from "../../shared/testing/fake-current-version.fake.js";
import { InMemoryEnvironment } from "../../shared/testing/in-memory-environment.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { flowTools } from "../../shared/testing/registered-tools.builder.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { askMarketplaceSource } from "../testing/ask-marketplace-source.builder.js";
import { setupMarketplaceRegistrar } from "../testing/setup-marketplace-registrar.builder.js";

const PROJECT_ROOT = "/test-project";
const SKIP_SWITCH = "AIDD_SKIP_MARKETPLACE_REFRESH";

function makeNoOpLatestResolver(isRepoPublic = true): ReleaseLister & RepositoryVisibility {
  return {
    listReleaseTags: vi.fn().mockResolvedValue([]),
    readReleaseBody: vi.fn().mockResolvedValue(null),
    isRepoPublic: vi.fn().mockResolvedValue(isRepoPublic),
  };
}

function makeRegisterFramework(scope: Scope): Pick<RegisterFrameworkMarketplace, "execute"> {
  return { execute: vi.fn().mockResolvedValue({ registered: true, scope }) };
}

interface Collaborators {
  tokenProvider?: TokenProvider;
  releaseResolver?: ReleaseLister & RepositoryVisibility;
  userSourceReferences?: UserSourceReferences;
  registeredScope?: Scope;
}

function makeUseCase(
  environment: InMemoryEnvironment,
  collaborators: Collaborators = {}
): {
  useCase: ReturnType<typeof setupMarketplaceRegistrar>;
  refresh: Pick<RefreshMarketplace, "execute">;
  register: Pick<RegisterFrameworkMarketplace, "execute">;
} {
  const refresh: Pick<RefreshMarketplace, "execute"> = {
    execute: vi.fn().mockResolvedValue({ results: [], failedCount: 0 }),
  };
  const register = makeRegisterFramework(collaborators.registeredScope ?? "user");
  const useCase = setupMarketplaceRegistrar(
    new InMemoryFileAdapter(),
    askMarketplaceSource(new KeepPrompter(), makeNoOpLatestResolver()),
    register,
    refresh,
    new FakeCurrentVersion(),
    new CapturingLogger(),
    environment,
    collaborators.tokenProvider,
    collaborators.releaseResolver,
    collaborators.userSourceReferences
  );
  return { useCase, refresh, register };
}

async function register(
  environment: InMemoryEnvironment
): Promise<Pick<RefreshMarketplace, "execute">> {
  const { useCase, refresh } = makeUseCase(environment);
  const flow = new SetupFlow({
    ...flowTools(),
    supportsUserScopeActivation: () => true,
    projectRoot: PROJECT_ROOT,
  });
  await useCase.register(flow, localFrameworkSource("/framework-source"));
  return refresh;
}

describe("RegisterMarketplace", () => {
  describe("catalog refresh", () => {
    it("refreshes the catalog when the environment carries no skip switch", async () => {
      const refresh = await register(new InMemoryEnvironment());

      expect(refresh.execute).toHaveBeenCalledWith({ projectRoot: PROJECT_ROOT });
    });

    it("skips the refresh when the environment sets the skip switch to 1", async () => {
      const refresh = await register(new InMemoryEnvironment({ [SKIP_SWITCH]: "1" }));

      expect(refresh.execute).not.toHaveBeenCalled();
    });

    it("refreshes when the skip switch carries any other value", async () => {
      const refresh = await register(new InMemoryEnvironment({ [SKIP_SWITCH]: "0" }));

      expect(refresh.execute).toHaveBeenCalledOnce();
    });
  });

  describe("remote auth guard", () => {
    it("refuses a private remote source when no token can be resolved", async () => {
      const { useCase } = makeUseCase(new InMemoryEnvironment(), {
        tokenProvider: { resolve: async () => null },
        releaseResolver: makeNoOpLatestResolver(false),
      });
      const flow = new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
      });

      const attempt = useCase.register(flow, remoteFrameworkSource("owner/repo"));

      await expect(attempt).rejects.toThrow(CatalogFetchAuthError);
      await expect(attempt).rejects.toThrow(
        'Authentication required to fetch catalog from "https://github.com/owner/repo". Run `aidd auth login` first or use `--source local --path <dir>`.'
      );
    });

    it("refuses a remote source when no token can be resolved and no release resolver can vouch for it", async () => {
      const { useCase } = makeUseCase(new InMemoryEnvironment(), {
        tokenProvider: { resolve: async () => null },
      });
      const flow = new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
      });

      const attempt = useCase.register(flow, remoteFrameworkSource("owner/repo"));

      await expect(attempt).rejects.toThrow(CatalogFetchAuthError);
    });
  });

  describe("registration options", () => {
    it("registers a local source at the project root, forcing the registration", async () => {
      const { useCase, register } = makeUseCase(new InMemoryEnvironment());
      const flow = new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
      });

      await useCase.register(flow, localFrameworkSource("/framework-source"));

      expect(register.execute).toHaveBeenCalledWith({
        projectRoot: PROJECT_ROOT,
        pluginSource: { kind: "local", path: "/framework-source" },
        force: true,
      });
    });

    it("registers a remote source by repository and ref", async () => {
      const { useCase, register } = makeUseCase(new InMemoryEnvironment());
      const flow = new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
      });

      await useCase.register(flow, remoteFrameworkSource("owner/repo", "v1.0.0"));

      expect(register.execute).toHaveBeenCalledWith({
        projectRoot: PROJECT_ROOT,
        pluginSource: { kind: "github", repo: "owner/repo", ref: "v1.0.0" },
        force: true,
      });
    });
  });

  describe("shared source reference", () => {
    it("records this project's claim on the shared source for a project-scope setup", async () => {
      const userSourceReferences = new UserSourceReferencesAdapter(
        new InMemoryFileAdapter({ [`${PROJECT_ROOT}/.aidd/manifest.json`]: "{}" }),
        () => "/user-config"
      );
      const { useCase } = makeUseCase(new InMemoryEnvironment(), { userSourceReferences });
      const flow = new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
      });

      await useCase.register(flow, localFrameworkSource("/framework-source"));

      expect(await userSourceReferences.listAllReferencingProjects()).toStrictEqual([PROJECT_ROOT]);
    });

    it("records no claim when the framework was registered at project scope", async () => {
      const userSourceReferences = new UserSourceReferencesAdapter(
        new InMemoryFileAdapter({ [`${PROJECT_ROOT}/.aidd/manifest.json`]: "{}" }),
        () => "/user-config"
      );
      const { useCase } = makeUseCase(new InMemoryEnvironment(), {
        userSourceReferences,
        registeredScope: "project",
      });
      const flow = new SetupFlow({
        ...flowTools(),
        supportsUserScopeActivation: () => true,
        projectRoot: PROJECT_ROOT,
      });

      await useCase.register(flow, localFrameworkSource("/framework-source"));

      expect(await userSourceReferences.listAllReferencingProjects()).toStrictEqual([]);
    });
  });
});
