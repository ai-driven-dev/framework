import { describe, expect, it } from "vitest";
import { DoctorRegistrationUseCase } from "../../../../src/contexts/framework/application/doctor/doctor-registration-use-case.js";
import { NativeHostRegistrationGate } from "../../../../src/contexts/host-registration/application/native-host-registration-gate.js";
import type { HostMarketplaceSources } from "../../../../src/contexts/host-registration/contract/host-marketplace-sources.js";
import type { HostPluginRegistryReading } from "../../../../src/contexts/host-registration/contract/host-plugin-registry.js";
import type { NativeRegistrations } from "../../../../src/contexts/installation/domain/manifest/native-registrations.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { InMemoryMarketplaceRegistry } from "../../../helpers/ports/in-memory-marketplace-registry.js";
import { FakeHostActions } from "../../host-registration/testing/fake-host-actions.js";
import { FakeHostPluginRegistry } from "../../host-registration/testing/fake-host-plugin-registry.js";
import { catalogOf, registeredAiProfile, TOOL } from "../../tools/testing/catalog-of.js";

const { copilot } = TOOL;
const HOST = "real-catalog";
const REF = `test-plugin@${HOST}`;
const LOCATION = "/host/registry";
const provenance = { kind: "registry" as const, source: "/owned/source" };
const registrations: NativeRegistrations = {
  binary: "copilot",
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
    update: `copilot: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Cannot prove AIDD-owned host ref '${REF}' is still enabled; refusing user-scope removal.`,
  },
  {
    reading: "unreadable",
    registry: { location: LOCATION, unreadable: "EACCES" },
    doctor: `info: ${LOCATION} could not be read — EACCES`,
    update: `copilot: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Catalogue '${HOST}': host plugin registry unreadable (EACCES); no host mutation made.`,
  },
  {
    reading: "ref missing",
    registry: { location: LOCATION, refs: new Map() },
    doctor: `error: copilot's registry (${LOCATION}) does not carry ${REF}`,
    update: `copilot: ref '${REF}' is not provably enabled on the host; update refused.`,
    removal: `Cannot prove AIDD-owned host ref '${REF}' is still enabled; refusing user-scope removal.`,
  },
  {
    reading: "ref disabled",
    registry: { location: LOCATION, refs: new Map([[REF, { enabled: false }]]) },
    doctor: `error: copilot's registry (${LOCATION}) carries ${REF} and records it disabled`,
    update: `copilot: ref '${REF}' is not provably enabled on the host; update refused.`,
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

function gateOver(registry: HostPluginRegistryReading, sources?: HostMarketplaceSources) {
  const activator = new FakeHostActions({ available: true });
  return new NativeHostRegistrationGate(
    new Map([[copilot, activator]]),
    new Map([[copilot, new FakeHostPluginRegistry(registry)]]),
    new Map(sources === undefined ? [] : [[copilot, sources]])
  );
}

async function doctorSays(registry: HostPluginRegistryReading): Promise<string> {
  const manifest = Manifest.create();
  manifest.addTool(copilot, "test", []);
  manifest.setNativeRegistrations(copilot, registrations);
  const issues = await new DoctorRegistrationUseCase(
    new InMemoryFileAdapter(),
    new InMemoryMarketplaceRegistry(),
    new Map(),
    new Map([[copilot, new FakeHostPluginRegistry(registry)]]),
    new Map(),
    () => "/user-cache",
    { get: () => "1.0.0" }
  ).execute({ manifest, projectRoot: "/A", allowedIds: null, tools: catalogOf() });
  return issues.length === 0 ? "none" : issues.map((i) => `${i.severity}: ${i.message}`).join("\n");
}

describe("registration verdicts across intents", () => {
  describe.each(REGISTRY_VERDICTS)("host plugin registry: $reading", (row) => {
    it("doctor", async () => {
      expect(await doctorSays(row.registry)).toBe(row.doctor);
    });

    it("targeted update", async () => {
      const gate = gateOver(row.registry, ownedSource(provenance));
      const attempt = gate.requireTargetedUpdate(
        registeredAiProfile(copilot),
        registrations.pluginClaims?.[0] ?? { ref: REF, dependents: [] },
        "/A",
        registrations
      );
      expect(await outcomeOf(attempt)).toBe(row.update);
    });

    it("catalogue removal", async () => {
      const gate = gateOver(row.registry, ownedSource(provenance));
      const attempt = gate.planMarketplaceRemoval(
        registeredAiProfile(copilot),
        registrations,
        registrations.marketplaces[0],
        "/A"
      );
      expect(await outcomeOf(attempt)).toBe(row.removal);
    });
  });

  describe.each([
    { source: "absent", entry: undefined, refused: "copilot: catalogue source unproven." },
    {
      source: "foreign",
      entry: { ...provenance, source: "/foreign/source" },
      refused: `Catalogue '${HOST}': current host source differs from AIDD's recorded source; reconcile manually.`,
    },
    { source: "owned", entry: provenance, refused: "proceeds" },
  ])("host marketplace source: $source", ({ entry, refused }) => {
    const registry = { location: LOCATION, refs: new Map([[REF, enabled]]) };

    it.each(["targeted update", "catalogue removal"] as const)("%s", async (intent) => {
      const gate = gateOver(registry, ownedSource(entry));
      const attempt =
        intent === "targeted update"
          ? gate.requireTargetedUpdate(
              registeredAiProfile(copilot),
              { ref: REF, dependents: [] },
              "/A",
              registrations
            )
          : gate.planMarketplaceRemoval(
              registeredAiProfile(copilot),
              registrations,
              registrations.marketplaces[0],
              "/A"
            );
      expect(await outcomeOf(attempt)).toBe(refused);
    });
  });
});
