import { registrationRecordRules } from "../../../src/composition/contexts/installation.js";
import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import { ResolveBuiltMarketplaces } from "../../../src/contexts/distribution/application/resolve-built-marketplaces.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { InspectDeclaredMarketplaces } from "../../../src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import type { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { ListRegisteredPlugins } from "../../../src/contexts/installation/application/doctor/list-registered-plugins.use-case.js";
import type {
  ScopeRecords,
  ToolRecords,
} from "../../../src/contexts/installation/contract/records/scope-records.js";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { CheckRegistrationRequest } from "../../../src/orchestration/doctor/check-registration.use-case.js";
import { CheckRegistration } from "../../../src/orchestration/doctor/check-registration.use-case.js";
import { ResolveRegisteredBuilds } from "../../../src/orchestration/doctor/resolve-registered-builds.use-case.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";

/** The registered tools and their built marketplaces, over the manifest and builds given. */
export function resolveRegisteredBuildsOver(
  manifests: ManifestRepository & ScopeRecords,
  builds: Pick<ResolveBuiltMarketplaces, "execute">,
  tools: RegisteredCatalog
): ResolveRegisteredBuilds {
  return new ResolveRegisteredBuilds(
    new ListRegisteredPlugins(manifests),
    { ...registrationRecordRules, loadRecords: () => manifests.loadRecords() },
    builds,
    tools
  );
}

/** The registration check wired as the composition root wires it. */
export function checkRegistrationOver(
  manifests: ManifestRepository & ScopeRecords,
  fs: FileReader,
  registry: MarketplaceRegistry,
  hostAvailable: (binary: string) => boolean,
  inspectHost: InspectHostRegistration,
  userCacheRoot: () => string,
  currentVersion: string,
  tools: RegisteredCatalog
): CheckRegistration {
  return new CheckRegistration({
    resolve: resolveRegisteredBuildsOver(
      manifests,
      new ResolveBuiltMarketplaces({ fs, registry, userCacheRoot, currentVersion }),
      tools
    ),
    declared: new InspectDeclaredMarketplaces(fs, hostAvailable, tools),
    inspectHost,
  });
}

export function buildCheckRegistration(
  ...wiring: Parameters<typeof checkRegistrationOver> extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return {
    execute: ({
      manifest,
      records,
      ...command
    }: CheckRegistrationRequest & { manifest: Manifest; records?: ToolRecords }) =>
      checkRegistrationOver(
        new InMemoryManifestRepository(manifest, undefined, records),
        ...wiring
      ).execute(command),
  };
}
