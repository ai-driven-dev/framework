import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PrepareMarketplace } from "../../../src/contexts/distribution/application/add/prepare-marketplace.use-case.js";
import { RecordMarketplace } from "../../../src/contexts/distribution/application/add/record-marketplace.use-case.js";
import { FetchMarketplaceSource } from "../../../src/contexts/distribution/application/fetch-marketplace-source.use-case.js";
import { ListMarketplaces } from "../../../src/contexts/distribution/application/list-marketplaces.use-case.js";
import { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.use-case.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { AddMarketplace } from "../../../src/orchestration/marketplace/add-marketplace.use-case.js";
import { RemoveRegisteredMarketplace } from "../../../src/orchestration/marketplace/remove/remove-registered-marketplace.use-case.js";
import { TrustDeniedError } from "../../../src/orchestration/orchestration.error.js";
import type { Prompter } from "../../../src/orchestration/ports/prompter.js";
import { SilentPrompterAdapter } from "../../../src/presentation/terminal/silent-prompter.adapter.js";
import {
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
} from "../../../src/shared/domain/shared.error.js";
import { removalClaimsOf } from "../../contexts/machine-claims/testing/claims-release.builder.js";
import { FixturePluginFetcher } from "../../shared/testing/fixture-plugin-fetcher.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { InMemoryMarketplaceTrustStore } from "../../shared/testing/in-memory-marketplace-trust-store.fake.js";
import { unusedRawCatalog } from "../../shared/testing/raw-catalog.fake.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { seedFromDirectory } from "../../shared/testing/seed-from-directory.builder.js";
import { syntheticCatalog } from "../../shared/testing/synthetic-tool-id.builder.js";
import { projectMarketplaceRemover } from "../testing/project-marketplace-remover.builder.js";

const MARKETPLACE_FIXTURE = join(process.cwd(), "tests/fixtures/framework/marketplace-sample");
const PROJECT_ROOT = "/test-project";
const NAME = "awesome";
const TRUST_QUESTION = `prompt: Trust marketplace '${NAME}'?`;
const SOURCE = { kind: "local" as const, path: MARKETPLACE_FIXTURE };

class AnsweringPrompter extends KeepPrompter {
  constructor(
    private readonly events: string[],
    private readonly answer: boolean
  ) {
    super();
  }

  override async confirm(message: string): Promise<boolean> {
    this.events.push(`prompt: ${message}`);
    return this.answer;
  }
}

/** `marketplace add` as the command runs it: the real removal scenario answers the overwrite,
 * and every step it takes lands in `events`, in order. */
async function marketplaceAdd(makePrompter: (events: string[]) => Prompter) {
  const fs = new InMemoryFileAdapter({});
  await seedFromDirectory(fs, MARKETPLACE_FIXTURE, { useAbsolutePaths: true });
  const events: string[] = [];
  const registry = new InMemoryMarketplaceRegistry();
  let registryReads = 0;
  const list = registry.list.bind(registry);
  registry.list = async (projectRoot) => {
    registryReads += 1;
    return list(projectRoot);
  };
  const save = registry.save.bind(registry);
  registry.save = async (projectRoot, marketplace) => {
    events.push("save");
    return save(projectRoot, marketplace);
  };
  const trustStore = new InMemoryMarketplaceTrustStore();
  const resolveMarketplace = new ResolveMarketplace(
    new FetchMarketplaceSource({
      pluginFetcher: new FixturePluginFetcher(),
      rawCatalog: unusedRawCatalog(),
    }),
    new PluginCatalogRepositoryAdapter(fs)
  );
  const resolve = resolveMarketplace.execute.bind(resolveMarketplace);
  resolveMarketplace.execute = async (command) => {
    events.push("resolve");
    return resolve(command);
  };
  const prompter = makePrompter(events);
  const manifestRepo = new InMemoryManifestRepository(Manifest.create());
  const remove = projectMarketplaceRemover(
    syntheticCatalog(),
    new RemoveProjectPlugin(fs, () => "/home/dev", removalClaimsOf(manifestRepo, fs)),
    manifestRepo,
    registry,
    prompter
  );
  const removals: { autoConfirm?: boolean; scope?: string }[] = [];
  const removeProject = {
    execute: async (request: Parameters<typeof remove.execute>[0]) => {
      events.push("remove");
      removals.push({ autoConfirm: request.autoConfirm, scope: request.scope });
      return remove.execute(request);
    },
  };
  const removeUser = {
    execute: async (): Promise<never> => {
      throw new Error("a project marketplace is removed by the project scenario");
    },
  };
  const add = new AddMarketplace({
    removeRegistered: new RemoveRegisteredMarketplace(
      new ListMarketplaces(registry),
      removeProject,
      removeUser
    ),
    prepare: new PrepareMarketplace(registry, trustStore, resolveMarketplace),
    record: new RecordMarketplace(registry, trustStore),
    prompter,
  });
  const command = {
    name: NAME,
    source: SOURCE,
    scope: "project" as const,
    projectRoot: PROJECT_ROOT,
  };
  return {
    add,
    command,
    events,
    removals,
    registry,
    trustStore,
    registryReads: () => registryReads,
  };
}

describe("marketplace add, the order it takes its steps in", () => {
  it("with overwrite, resolves, then asks for trust, then removes the registered entry, then saves", async () => {
    const { add, command, events, removals, registry } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({ ...command, addedAt: "2026-01-01T00:00:00.000Z" })
    );
    events.length = 0;

    await add.execute({ ...command, autoTrust: false, overwrite: true });

    expect(events).toEqual(["resolve", TRUST_QUESTION, "remove", "save"]);
    expect(removals).toEqual([{ autoConfirm: true, scope: "project" }]);
  });

  it("with overwrite, replaces the project entry that hides a user entry of the same name", async () => {
    const { add, command, registry } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );
    const addedAt = "2026-01-01T00:00:00.000Z";
    await registry.save(PROJECT_ROOT, Marketplace.create({ ...command, addedAt }));
    await registry.save(PROJECT_ROOT, Marketplace.create({ ...command, scope: "user", addedAt }));

    await add.execute({ ...command, autoTrust: true, overwrite: true });

    expect(registry.getAll(PROJECT_ROOT).map((m) => m.scope)).toEqual(["project", "user"]);
    expect((await registry.list(PROJECT_ROOT))[0]?.addedAt).not.toBe(addedAt);
  });

  it("with overwrite of a name not registered, removes nothing and adds it", async () => {
    const { add, command, events, removals, registry } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );

    await add.execute({ ...command, autoTrust: true, overwrite: true });

    expect(events).toEqual(["resolve", "save"]);
    expect(removals).toEqual([]);
    expect(await registry.list(PROJECT_ROOT)).toHaveLength(1);
  });

  it("with overwrite, a fetch failure leaves the previous entry recorded and removes nothing", async () => {
    const { add, command, events, removals, registry } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({ ...command, addedAt: "2026-01-01T00:00:00.000Z" })
    );
    events.length = 0;

    await expect(
      add.execute({
        ...command,
        source: { kind: "local", path: "/empty-marketplace-dir" },
        autoTrust: true,
        overwrite: true,
      })
    ).rejects.toThrow(InvalidPluginManifestError);

    expect(events).toEqual(["resolve"]);
    expect(removals).toEqual([]);
    expect(await registry.list(PROJECT_ROOT)).toHaveLength(1);
  });

  it.each([false, true])(
    "refuses the reserved name before it reads the registry, with overwrite %s",
    async (overwrite) => {
      const { add, command, registryReads } = await marketplaceAdd(
        (recorded) => new AnsweringPrompter(recorded, true)
      );

      await expect(
        add.execute({ ...command, name: FRAMEWORK_MARKETPLACE_NAME, autoTrust: true, overwrite })
      ).rejects.toThrow(InvalidMarketplaceNameError);

      expect(registryReads()).toBe(0);
    }
  );

  it("asks for no trust when autoTrust is set", async () => {
    const { add, command, events } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );

    await add.execute({ ...command, autoTrust: true });

    expect(events).toEqual(["resolve", "save"]);
  });

  it("asks for no trust when the source is already trusted", async () => {
    const { add, command, events, trustStore } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, false)
    );
    await trustStore.trust(PROJECT_ROOT, SOURCE);

    await add.execute({ ...command, autoTrust: false });

    expect(events).toEqual(["resolve", "save"]);
  });

  it("saves nothing when the prompt is denied", async () => {
    const { add, command, events } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, false)
    );

    await expect(add.execute({ ...command, autoTrust: false })).rejects.toThrow(TrustDeniedError);

    expect(events).toEqual(["resolve", TRUST_QUESTION]);
  });

  it("trusts and saves without a person to ask when the prompter is the silent one", async () => {
    const { add, command, trustStore, registry } = await marketplaceAdd(
      () => new SilentPrompterAdapter()
    );

    await add.execute({ ...command, autoTrust: false });

    expect(await trustStore.isTrusted(PROJECT_ROOT, SOURCE)).toBe(true);
    expect(await registry.list(PROJECT_ROOT)).toHaveLength(1);
  });
});
