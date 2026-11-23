import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../../src/contexts/distribution/domain/marketplace.js";
import { LoadSyncContext } from "../../../../src/contexts/installation/application/sync/load-sync-context.use-case.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import {
  RecordSyncActivation,
  type RecordSyncActivationDeps,
  type RecordSyncActivationRequest,
} from "../../../../src/orchestration/sync/settings/record-sync-activation.use-case.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT_ROOT = "/test-project";

async function requestOf(
  scope: Scope,
  extra: Partial<RecordSyncActivationRequest["options"]> = {}
): Promise<RecordSyncActivationRequest> {
  const registry = new InMemoryMarketplaceRegistry();
  registry.seed(
    PROJECT_ROOT,
    Marketplace.create({
      name: "mk",
      source: { kind: "local", path: "/src" },
      scope: "project",
      addedAt: "2001-01-01T00:00:00Z",
    })
  );
  const loader = new LoadSyncContext({
    manifestRepo: new InMemoryManifestRepository(Manifest.create(), PROJECT_ROOT),
    marketplaceRegistry: registry,
    frameworkMarketplaceName: "framework",
  });
  const context = await loader.execute({ projectRoot: PROJECT_ROOT, scope });
  if (context === null) throw new Error("the seeded project has a manifest and a marketplace");
  return {
    options: { projectRoot: PROJECT_ROOT, ...extra },
    scope,
    context,
    activation: { outcomes: new Map(), binaryMissing: [], warnings: [], errors: [] },
  };
}

function depsOver(wrote?: "settings-written-by-host" | "native-registrations") {
  const calls: string[] = [];
  const deps: RecordSyncActivationDeps = {
    recordActivation: {
      execute: async (request) => {
        calls.push(`activation:${request.kind}`);
        return request.kind === wrote;
      },
    },
    machineClaims: {
      execute: async (request) => {
        calls.push(`claims:${request.scope}:${request.projectRoot ?? "-"}`);
        return false;
      },
    },
    sharedSource: {
      execute: async (request) => {
        calls.push(`shared:${request.kind}`);
      },
    },
    recordRegistrations: {
      execute: () => {
        calls.push("activation:native-registrations");
        return wrote === "native-registrations";
      },
    },
  };
  return { deps, calls };
}

describe("recording what a sync activated", () => {
  it("records the shared reference, the hashes, the registrations and the machine claims for a project run", async () => {
    const { deps, calls } = depsOver();

    await new RecordSyncActivation(deps).execute(await requestOf("project"));

    expect(calls).toStrictEqual([
      "shared:record-reference",
      "activation:settings-written-by-host",
      "activation:native-registrations",
      `claims:project:${PROJECT_ROOT}`,
    ]);
  });

  it("claims no shared reference and names no project for a user-scope run", async () => {
    const { deps, calls } = depsOver();

    await new RecordSyncActivation(deps).execute(await requestOf("user"));

    expect(calls).toStrictEqual([
      "activation:settings-written-by-host",
      "activation:native-registrations",
      "claims:user:-",
    ]);
  });

  it("purges the stale project cache only when the run recreates the framework at project scope", async () => {
    const { deps, calls } = depsOver();

    await new RecordSyncActivation(deps).execute(
      await requestOf("project", { recreateFrameworkIfMissing: true })
    );

    expect(calls.at(-1)).toBe("shared:purge-stale-project-cache");
  });

  it.each(["settings-written-by-host", "native-registrations"] as const)(
    "saves the manifest when %s changed a record",
    async (kind) => {
      const { deps } = depsOver(kind);
      const request = await requestOf("project");
      let saved = 0;
      const context = {
        ...request.context,
        save: async () => {
          saved += 1;
        },
      };

      await new RecordSyncActivation(deps).execute({ ...request, context });

      expect(saved).toBe(1);
    }
  );
});
