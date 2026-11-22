/** Seeds a user-scope marketplace removal over a native host, so each removal case states only what it varies. */

import type { registrationRecordRules } from "../../../src/composition/installation.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { NativeHostRegistrationGate } from "../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import type { NativeMarketplaceSource } from "../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { userMarketplaceRemover } from "./user-marketplace-remover.builder.js";

type RecordRules = typeof registrationRecordRules;

export const ALIAS = "project-alias";
export const HOST = "real-catalog";
export const REF = `test-plugin@${HOST}`;
export function options() {
  return {
    name: ALIAS,
    projectRoot: "/A",
    autoConfirm: true,
    scope: "user" as const,
  };
}

export function proofFor(): NativeMarketplaceSource {
  return {
    kind: "effective-list",
    root: "/exact/host/root",
    sourceType: "github",
    source: "ai-driven-dev/framework",
  };
}

export function sourceReader(): HostMarketplaceSources {
  return {
    read: async () => ({
      location: "/host/catalogues",
      entries: new Map([[HOST, proofFor()]]),
    }),
  };
}

export async function nativeFixture(
  toolId: AiToolId,
  refs: ReadonlyMap<string, { enabled: boolean; scope?: Scope }>,
  options: {
    dependents?: readonly string[];
    available?: boolean;
    failOnUninstall?: boolean;
    throwOnRemove?: boolean;
    records?: RecordRules;
  } = {}
) {
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  machine.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: [{ alias: ALIAS, hostName: HOST, provenance: proofFor() }],
    pluginRefs: [REF],
    pluginClaims: [{ ref: REF, dependents: [...(options.dependents ?? [])] }],
  });
  const repo = new InMemoryManifestRepository(machine);
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    "/A",
    Marketplace.create({
      name: ALIAS,
      source: { kind: "github", repo: "ai-driven-dev/framework" },
      scope: "user",
      addedAt: "2026-09-01T00:00:00.000Z",
    })
  );
  const activator = new FakeHostActions({
    available: options.available ?? true,
    failOnUninstall: options.failOnUninstall ? [REF] : [],
    throwOnRemove: options.throwOnRemove ?? false,
  });
  const reader: HostPluginRegistry = {
    read: async () => ({ location: "/host/registry", refs }),
  };
  const useCase = userMarketplaceRemover(
    new InMemoryFileAdapter(),
    repo,
    registry,
    new NativeHostRegistrationGate(
      new Map([[toolId, activator]]),
      new Map([[toolId, reader]]),
      new Map([[toolId, sourceReader()]])
    ),
    options.records
  );
  return { repo, registry, activator, useCase };
}
