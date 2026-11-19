import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AddMarketplace } from "../../../src/contexts/distribution/application/add-marketplace.js";
import { FetchMarketplaceSource } from "../../../src/contexts/distribution/application/fetch-marketplace-source.js";
import { ResolveMarketplace } from "../../../src/contexts/distribution/application/resolve-marketplace.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../src/contexts/distribution/contract/marketplace.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { PluginCatalogRepositoryAdapter } from "../../../src/contexts/distribution/infrastructure/plugin-catalog-repository-adapter.js";
import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { removalClaims } from "../../../src/contexts/machine-claims/application/removal-claims.js";
import { SilentPrompterAdapter } from "../../../src/presentation/terminal/prompter-adapter.js";
import {
  InvalidMarketplaceNameError,
  TrustDeniedError,
} from "../../../src/shared/domain/errors.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { FixturePluginFetcher } from "../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { InMemoryMarketplaceRegistry } from "../../helpers/ports/in-memory-marketplace-registry.js";
import { InMemoryMarketplaceTrustStore } from "../../helpers/ports/in-memory-marketplace-trust-store.js";
import { seedFromDirectory } from "../../helpers/ports/seed-from-directory.js";
import { projectMarketplaceRemover } from "../../helpers/project-marketplace-remover.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.js";

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
    new FetchMarketplaceSource(new FixturePluginFetcher()),
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
    new RemoveProjectPlugin(fs, removalClaims(manifestRepo, fs)),
    manifestRepo,
    registry,
    prompter
  );
  const removals: { autoConfirm?: boolean; scope?: string }[] = [];
  const add = new AddMarketplace(registry, trustStore, resolveMarketplace, prompter, {
    remove: async (request) => {
      events.push("remove");
      removals.push({ autoConfirm: request.autoConfirm, scope: request.scope });
      await remove.execute(request);
    },
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
  it("with overwrite, removes the registered entry before it resolves, then asks for trust, then saves", async () => {
    const { add, command, events, removals, registry } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({ ...command, addedAt: "2026-01-01T00:00:00.000Z" })
    );
    events.length = 0;

    await add.execute({ ...command, autoTrust: false, overwrite: true });

    expect(events).toEqual(["remove", "resolve", TRUST_QUESTION, "save"]);
    expect(removals).toEqual([{ autoConfirm: true, scope: "project" }]);
  });

  it("refuses the reserved name before it reads the registry", async () => {
    const { add, command, registryReads } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );

    await expect(
      add.execute({ ...command, name: FRAMEWORK_MARKETPLACE_NAME, autoTrust: true })
    ).rejects.toThrow(InvalidMarketplaceNameError);

    expect(registryReads()).toBe(0);
  });

  it("asks for no trust when autoTrust is set", async () => {
    const { add, command, events } = await marketplaceAdd(
      (recorded) => new AnsweringPrompter(recorded, true)
    );

    await add.execute({ ...command, autoTrust: true });

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
