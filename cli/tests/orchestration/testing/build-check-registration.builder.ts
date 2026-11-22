import { registrationRecordRules } from "../../../src/composition/installation.js";
import { ResolveBuiltMarketplaces } from "../../../src/contexts/distribution/application/resolve-built-marketplaces.use-case.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import { InspectDeclaredMarketplaces } from "../../../src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import type { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { ListRegisteredPlugins } from "../../../src/contexts/installation/application/doctor/list-registered-plugins.use-case.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { CheckRegistrationRequest } from "../../../src/orchestration/doctor/check-registration.use-case.js";
import { CheckRegistration } from "../../../src/orchestration/doctor/check-registration.use-case.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";

/** The registration check wired as the composition root wires it. */
export function checkRegistrationOver(
  loadManifest: LoadManifest,
  fs: FileReader,
  registry: MarketplaceRegistry,
  hostAvailable: (binary: string) => boolean,
  inspectHost: InspectHostRegistration,
  userCacheRoot: () => string,
  currentVersion: string,
  tools: ToolCatalog
): CheckRegistration {
  return new CheckRegistration(
    {
      listPlugins: new ListRegisteredPlugins(loadManifest),
      records: registrationRecordRules,
      builds: new ResolveBuiltMarketplaces({ fs, registry, userCacheRoot, currentVersion }),
      declared: new InspectDeclaredMarketplaces(fs, hostAvailable, tools),
      inspectHost,
    },
    tools
  );
}

export function buildCheckRegistration(
  ...wiring: Parameters<typeof checkRegistrationOver> extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return {
    execute: ({ manifest, ...command }: CheckRegistrationRequest & { manifest: Manifest }) =>
      checkRegistrationOver(
        new LoadManifest(new InMemoryManifestRepository(manifest)),
        ...wiring
      ).execute(command),
  };
}
