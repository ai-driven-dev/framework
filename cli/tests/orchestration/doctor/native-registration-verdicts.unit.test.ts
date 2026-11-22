import { describe, expect, it } from "vitest";
import { RefreshHostPlugin } from "../../../src/contexts/host-registration/application/refresh-host-plugin.use-case.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { RegistrationRecord } from "../../../src/contexts/host-registration/domain/record/registration-record.js";
import type { HostMarketplaceSources } from "../../../src/contexts/host-registration/ports/host-marketplace-sources.js";
import type { NativeRegistrations } from "../../../src/contexts/installation/domain/manifest/native-registrations.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostInspector } from "../../shared/testing/host-inspector.builder.js";
import {
  hostWithdrawal,
  proveMarketplaceRemoval,
} from "../../shared/testing/host-withdrawal.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  SYNTHETIC_UPDATING_NATIVE_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { buildCheckRegistration } from "../testing/build-check-registration.builder.js";

const tool = SYNTHETIC_UPDATING_NATIVE_TOOL;
const HOST = "real-catalog";
const REF = `test-plugin@${HOST}`;
const LOCATION = "/host/registry";
const provenance = { kind: "registry" as const, source: "/owned/source" };
const registrations: NativeRegistrations & RegistrationRecord = {
  binary: SYNTHETIC_UPDATING_NATIVE_TOOL,
  marketplaces: [{ alias: "alias", hostName: HOST, provenance }],
  pluginRefs: [REF],
  pluginClaims: [{ ref: REF, dependents: [] }],
};
const ownedSource = (entry: typeof provenance | null | undefined): HostMarketplaceSources => ({
  read: async () => ({
    location: "/host/catalogue",
    entries: new Map(entry === undefined ? [] : [[HOST, entry]]),
  }),
});

const enabled = { enabled: true, scope: "user" as const };
const foreign = ["foreign@real-catalog", enabled] as const;

type Outcome = "proceeds" | string;

/**
 * One host reading, put to every intent that consults the host's own plugin registry: what
 * `doctor` says, whether a targeted update may start, whether a catalogue may be removed. A
 * refusal names its exact message, so a verdict that moves from refusal to proceeding, or the
 * reverse, shows here whichever intent it moved in.
 */
const REGISTRY_VERDICTS: ReadonlyArray<{
  reading: string;
  registry: HostPluginRegistryReading;
  doctor: string;
  update: Outcome;
  removal: Outcome;
}> = [
  {
    reading: "absent",
    registry: { location: LOCATION, absent: true },
    doctor: `info: ${LOCATION} could not be read — ENOENT`,
    update: `${SYNTHETIC_UPDATING_NATIVE_TOOL}: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Cannot prove AIDD-owned host ref '${REF}' is still enabled; refusing user-scope removal.`,
  },
  {
    reading: "unreadable",
    registry: { location: LOCATION, unreadable: "EACCES" },
    doctor: `info: ${LOCATION} could not be read — EACCES`,
    update: `${SYNTHETIC_UPDATING_NATIVE_TOOL}: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Catalogue '${HOST}': host plugin registry unreadable (EACCES); no host mutation made.`,
  },
  {
    reading: "ref missing",
    registry: { location: LOCATION, refs: new Map() },
    doctor: `error: ${SYNTHETIC_UPDATING_NATIVE_TOOL}'s registry (${LOCATION}) does not carry ${REF}`,
    update: `${SYNTHETIC_UPDATING_NATIVE_TOOL}: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Cannot prove AIDD-owned host ref '${REF}' is still enabled; refusing user-scope removal.`,
  },
  {
    reading: "ref disabled",
    registry: { location: LOCATION, refs: new Map([[REF, { enabled: false }]]) },
    doctor: `error: ${SYNTHETIC_UPDATING_NATIVE_TOOL}'s registry (${LOCATION}) carries ${REF} and records it disabled`,
    update: `${SYNTHETIC_UPDATING_NATIVE_TOOL}: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Cannot prove AIDD-owned host ref '${REF}' is still enabled; refusing user-scope removal.`,
  },
  {
    reading: "foreign ref beside the owned one",
    registry: { location: LOCATION, refs: new Map([[REF, enabled], foreign]) },
    doctor: "none",
    update: "proceeds",
    removal: `Catalogue '${HOST}' includes foreign host ref 'foreign@real-catalog'; no host mutation made.`,
  },
  {
    reading: "owned ref enabled",
    registry: { location: LOCATION, refs: new Map([[REF, enabled]]) },
    doctor: "none",
    update: "proceeds",
    removal: "proceeds",
  },
];

/** The same refusal wording the three intents give, whatever registry they read. */
async function outcomeOf(attempt: Promise<unknown>): Promise<Outcome> {
  try {
    await attempt;
    return "proceeds";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function hostOver(registry: HostPluginRegistryReading, sources?: HostMarketplaceSources) {
  return [
    new Map([[tool, new FakeHostActions({ available: true })]]),
    new Map([[tool, new FakeHostPluginRegistry(registry)]]),
    new Map(sources === undefined ? [] : [[tool, sources]]),
  ] as const;
}

const refreshOf = (registry: HostPluginRegistryReading, sources?: HostMarketplaceSources) =>
  new RefreshHostPlugin(...hostOver(registry, sources)).execute({
    tool: syntheticNativeFamilyCatalog().aiProfile(tool),
    ref: REF,
    projectRoot: "/A",
    registrations,
  });

async function doctorSays(registry: HostPluginRegistryReading): Promise<string> {
  const manifest = Manifest.create();
  manifest.addTool(tool, "test", []);
  manifest.setNativeRegistrations(tool, registrations);
  const issues = await buildCheckRegistration(
    new InMemoryFileAdapter(),
    new InMemoryMarketplaceRegistry(),
    () => false,
    hostInspector(syntheticNativeFamilyCatalog(), {
      fs: new InMemoryFileAdapter(),
      pluginRegistries: new Map([[tool, new FakeHostPluginRegistry(registry)]]),
      marketplaceRegistries: new Map(),
    }),
    () => "/user-cache",
    "1.0.0",
    syntheticNativeFamilyCatalog()
  ).execute({ manifest, projectRoot: "/A", allowedIds: null });
  return issues.length === 0 ? "none" : issues.map((i) => `${i.severity}: ${i.message}`).join("\n");
}

describe("registration verdicts across intents", () => {
  describe.each(REGISTRY_VERDICTS)("host plugin registry: $reading", (row) => {
    it("doctor", async () => {
      expect(await doctorSays(row.registry)).toBe(row.doctor);
    });

    it("targeted update", async () => {
      const attempt = refreshOf(row.registry, ownedSource(provenance));
      expect(await outcomeOf(attempt)).toBe(row.update);
    });

    it("catalogue removal", async () => {
      const gate = hostWithdrawal(...hostOver(row.registry, ownedSource(provenance)));
      const attempt = proveMarketplaceRemoval(
        gate,
        syntheticNativeFamilyCatalog().aiProfile(tool),
        registrations,
        {
          registration: registrations.marketplaces[0],
          projectRoot: "/A",
          claimedRefs: [REF],
        }
      );
      expect(await outcomeOf(attempt)).toBe(row.removal);
    });
  });

  describe.each([
    {
      source: "absent",
      entry: undefined,
      refused: `${SYNTHETIC_UPDATING_NATIVE_TOOL}: catalogue source unproven.`,
    },
    {
      source: "foreign",
      entry: { ...provenance, source: "/foreign/source" },
      refused: `Catalogue '${HOST}': current host source differs from AIDD's recorded source; reconcile manually.`,
    },
    { source: "owned", entry: provenance, refused: "proceeds" },
  ])("host marketplace source: $source", ({ entry, refused }) => {
    const registry = { location: LOCATION, refs: new Map([[REF, enabled]]) };

    it.each(["targeted update", "catalogue removal"] as const)("%s", async (intent) => {
      const attempt =
        intent === "targeted update"
          ? refreshOf(registry, ownedSource(entry))
          : proveMarketplaceRemoval(
              hostWithdrawal(...hostOver(registry, ownedSource(entry))),
              syntheticNativeFamilyCatalog().aiProfile(tool),
              registrations,
              {
                registration: registrations.marketplaces[0],
                projectRoot: "/A",
                claimedRefs: [REF],
              }
            );
      expect(await outcomeOf(attempt)).toBe(refused);
    });
  });
});
