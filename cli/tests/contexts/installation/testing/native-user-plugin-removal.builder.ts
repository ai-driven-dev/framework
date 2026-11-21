import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import type { RegistrationRecordRules } from "../../../../src/contexts/installation/ports/native-host.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import type { FakeNativeSource } from "./fake-host-marketplace-sources.fake.js";
import type { FixedHostRegistry } from "./fake-host-plugin-registry.fake.js";
import { FakeMarketplaceRegistry } from "./fake-marketplace-registry.fake.js";
import { userPluginRemover } from "./plugin-remover.builder.js";

export const NATIVE_REF = "test-plugin@real-catalog";
export const OTHER_NATIVE_REF = "test-plugin@other-catalog";

export function nativeSourceFor(toolId: AiToolId, catalogue: string): FakeNativeSource {
  return toolId === "codex"
    ? {
        kind: "effective-list",
        root: `/host/${catalogue}`,
        sourceType: "github",
        source: `ai-driven-dev/${catalogue}`,
      }
    : { kind: "registry", source: `https://github.com/ai-driven-dev/${catalogue}.git` };
}

export interface NativeRemovalOptions {
  refs?: readonly string[];
  dependents?: readonly string[];
  hostRefs?: ReadonlyMap<string, { enabled: boolean; scope?: Scope }>;
  available?: boolean;
  failOnUninstall?: boolean;
  sourceMismatch?: boolean;
  sourceUnavailable?: boolean;
  legacy?: boolean;
  hostRegistryUnavailable?: boolean;
  hostRegistryUnreadable?: boolean;
  records?: RegistrationRecordRules;
}

const catalogueOf = (ref: string): string => ref.split("@")[1];

function claimedMachine(toolId: AiToolId, refs: readonly string[], options: NativeRemovalOptions) {
  const machine = Manifest.create();
  machine.addTool(toolId, "1.0.0", []);
  machine.setNativeRegistrations(toolId, {
    binary: toolId,
    marketplaces: refs.map((ref) => ({
      alias: catalogueOf(ref),
      hostName: catalogueOf(ref),
      ...(options.legacy ? {} : { provenance: nativeSourceFor(toolId, catalogueOf(ref)) }),
    })),
    pluginRefs: [...refs],
    pluginClaims: refs.map((ref) => ({ ref, dependents: [...(options.dependents ?? [])] })),
  });
  return machine;
}

function hostRegistryOf(refs: readonly string[], options: NativeRemovalOptions): FixedHostRegistry {
  const hostRefs =
    options.hostRefs ??
    new Map(refs.map((ref) => [ref, { enabled: true, scope: "user" as const }]));
  return {
    read: async () =>
      options.hostRegistryUnreadable
        ? { location: "/host/registry", unreadable: "invalid host registry" }
        : { location: "/host/registry", refs: hostRefs },
  };
}

function catalogueSourcesOf(toolId: AiToolId, refs: readonly string[], mismatch: boolean) {
  return {
    read: async () => ({
      location: "/host/catalogues",
      entries: new Map(
        refs.map((ref) => {
          const foreign = mismatch && ref === NATIVE_REF;
          const source = nativeSourceFor(toolId, foreign ? "foreign-source" : catalogueOf(ref));
          return [catalogueOf(ref), source] as const;
        })
      ),
    }),
  };
}

/** A machine that claims native plugin refs on one host, with the host's registry, its catalogue
 * sources and its uninstall answering as the options say. */
export function nativeUserPluginRemoval(toolId: AiToolId, options: NativeRemovalOptions = {}) {
  const refs = options.refs ?? [NATIVE_REF];
  const machine = claimedMachine(toolId, refs, options);
  const repo = new InMemoryManifestRepository(machine);
  const fs = new InMemoryFileAdapter();
  const activator = new FakeHostActions({
    available: options.available ?? true,
    failOnUninstall: options.failOnUninstall ? [NATIVE_REF] : [],
  });
  const sources = catalogueSourcesOf(toolId, refs, options.sourceMismatch === true);
  const remove = userPluginRemover({
    fs,
    activators: new Map([[toolId, activator]]),
    hostPluginRegistries: options.hostRegistryUnavailable
      ? new Map()
      : new Map([[toolId, hostRegistryOf(refs, options)]]),
    marketplaceRegistry: new FakeMarketplaceRegistry(),
    userManifestRepo: repo,
    ...(options.records === undefined ? {} : { records: options.records }),
    nativeMarketplaceSources: options.sourceUnavailable ? new Map() : new Map([[toolId, sources]]),
  });
  return { machine, repo, fs, activator, remove };
}
