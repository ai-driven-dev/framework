import { describe, expect, it, vi } from "vitest";
import {
  type MarketplaceHostTarget,
  PurgeMarketplacePlugins,
  type PurgeMarketplacePluginsRequest,
} from "../../../../../src/contexts/installation/application/marketplace/purge-marketplace-plugins.use-case.js";
import type { ToolRecords } from "../../../../../src/contexts/installation/contract/records/scope-records.js";
import { ActiveMachineDependentsError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { holdersRecorded } from "../../../../shared/testing/host-record-reading.builder.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { FakeUserScopePluginFiles } from "../../testing/fake-user-scope-plugin-files.fake.js";
import { REWRITTEN_BINARY, spiedRecordRules } from "../../testing/spy-record-rules.fake.js";

const MARKET = "mkt";
const HOST_NAME = "host-mkt";
const PROJECT = "/proj";
const HOME = "/home";

/** Holds the manifest in memory, counting the lock and noting each read and write. */
class LockedRepository extends InMemoryManifestRepository {
  locked = 0;
  constructor(
    seed: Manifest,
    private readonly events: string[],
    records: ToolRecords
  ) {
    super(seed, PROJECT, records);
  }
  override async load(): Promise<Manifest | null> {
    this.events.push("load");
    return super.load();
  }
  override async save(manifest: Manifest): Promise<void> {
    this.events.push("save");
    return super.save(manifest);
  }
  override async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    this.locked++;
    return super.withExclusiveAccess(action);
  }
}

function plugin(
  name: string,
  options: { marketplace?: string; scope?: Scope; dependents?: string[] } = {}
): RecordedPlugin {
  return RecordedPlugin.fromJSON({
    name,
    source: { kind: "local", path: `/src/${name}` },
    version: "1.0.0",
    strict: false,
    files: { [`${name}/a.md`]: "0".repeat(32) },
    scope: options.scope ?? "user",
    marketplace: options.marketplace ?? MARKET,
    dependents: options.dependents ?? [],
  });
}

const record = (...claims: { ref: string; dependents: string[] }[]) => ({
  binary: "claude",
  marketplaces: [{ alias: MARKET, hostName: HOST_NAME }],
  pluginRefs: claims.map((claim) => claim.ref),
  pluginClaims: claims,
});

interface Seed {
  plugins?: RecordedPlugin[];
  native?: ReturnType<typeof record>;
  /** A plugin whose proven files fall short of what it tracks. */
  partial?: string;
  /** A second tool whose host records the same catalogue and refuses its removal plan. */
  refusingCodex?: boolean;
}

function setup(seed: Seed = {}) {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  for (const p of seed.plugins ?? [plugin("one")]) manifest.addPlugin(TOOL.claude, p);
  const records: ToolRecords = new Map();
  if (seed.native !== undefined) records.set(TOOL.claude, seed.native);
  if (seed.refusingCodex) {
    manifest.addTool(TOOL.codex, "1.0.0", []);
    records.set(TOOL.codex, record());
  }
  const events: string[] = [];
  const repo = new LockedRepository(manifest, events, records);
  const withdraw = vi.fn();
  const proven = new Map(
    (seed.plugins ?? [plugin("one")]).map((p) => [
      p.plugin.name,
      new Map(p.plugin.name === seed.partial ? [] : p.plugin.files),
    ])
  );
  const files = new FakeUserScopePluginFiles(proven);
  const { rules, withoutMarketplace } = spiedRecordRules();
  const purge = new PurgeMarketplacePlugins(
    { repo, userScopePluginFiles: files },
    registeredTools()
  );
  const command: PurgeMarketplacePluginsRequest<MarketplaceHostTarget> = {
    marketplace: MARKET,
    projectRoot: PROJECT,
    home: HOME,
    whileLocked: async () => {
      events.push("whileLocked");
    },
    forget: async () => {
      events.push("forget");
    },
    hostRemoval: {
      plan: async (target) => {
        if (target.tool.toolId === TOOL.codex) throw new Error("plan refused");
        return target;
      },
      apply: (target) => withdraw(target.registration.hostName),
    },
    records: {
      loadRecords: () => repo.loadRecords(),
      saveRecords: (saved) => repo.saveRecords(saved),
      registrationOf: rules.marketplaceOf,
      holdersOf: holdersRecorded,
      claimsOn: rules.claimsOnMarketplace,
      withoutMarketplace: rules.withoutMarketplace,
    },
  };
  return {
    purge,
    command,
    repo,
    files,
    events,
    withdraw,
    withoutMarketplace,
  };
}

describe("purging a marketplace's plugins from the machine", () => {
  it("refuses a machine with no manifest", async () => {
    const s = setup();
    await s.repo.delete();
    s.events.length = 0;

    await expect(s.purge.execute(s.command)).rejects.toThrow("no user manifest");
  });

  it("refuses a marketplace the manifest holds no plugin or catalogue claim of", async () => {
    const s = setup({ plugins: [plugin("one", { marketplace: "other" })] });

    await expect(s.purge.execute(s.command)).rejects.toThrow("no canonical plugin or host");
    expect(s.events).not.toContain("save");
  });

  it("leaves a project-scope plugin of the same marketplace out of the purge", async () => {
    const s = setup({ plugins: [plugin("one", { scope: "project" })] });

    await expect(s.purge.execute(s.command)).rejects.toThrow("no canonical plugin or host");
  });

  it("refuses while a project still depends on one of its plugins, removing nothing", async () => {
    const s = setup({ plugins: [plugin("one", { dependents: ["/other"] })] });

    await expect(s.purge.execute(s.command)).rejects.toThrow(ActiveMachineDependentsError);
    expect(s.files.removed).toHaveLength(0);
    expect(s.events).not.toContain("save");
  });

  it("refuses while a project still holds a claim on one of its host refs", async () => {
    const s = setup({
      plugins: [],
      native: record({ ref: `one@${HOST_NAME}`, dependents: ["/other"] }),
    });

    await expect(s.purge.execute(s.command)).rejects.toThrow(saying("/other"));
    expect(s.withdraw).not.toHaveBeenCalled();
  });

  it("refuses a partial removal when a tracked file is not proven, removing nothing", async () => {
    const s = setup({ partial: "one" });

    await expect(s.purge.execute(s.command)).rejects.toThrow("Refusing partial");
    expect(s.files.removed).toHaveLength(0);
    expect(s.events).not.toContain("save");
  });

  it("removes the plugins, their files and the host claims, then saves what is left", async () => {
    const s = setup({
      plugins: [plugin("one"), plugin("two", { marketplace: "other" })],
      native: record(
        { ref: `one@${HOST_NAME}`, dependents: [] },
        { ref: "x@elsewhere", dependents: [] }
      ),
    });

    const removed = await s.purge.execute(s.command);

    const saved = await s.repo.load();
    expect(removed).toBe(2);
    expect(s.files.provenHomes).toStrictEqual([HOME]);
    expect(s.files.removed).toHaveLength(1);
    expect(s.withdraw).toHaveBeenCalledWith(HOST_NAME);
    expect(saved?.getPlugins(TOOL.claude).map((p) => p.name)).toStrictEqual(["two"]);
    expect(s.withoutMarketplace).toHaveBeenCalledWith(expect.anything(), MARKET);
    expect(s.repo.records.get(TOOL.claude)).toMatchObject({ binary: REWRITTEN_BINARY });
  });

  it("plans every host removal before it withdraws from any host", async () => {
    const s = setup({
      plugins: [],
      native: record({ ref: `one@${HOST_NAME}`, dependents: [] }),
      refusingCodex: true,
    });

    await expect(s.purge.execute(s.command)).rejects.toThrow("plan refused");
    expect(s.withdraw).not.toHaveBeenCalled();
  });

  it("withdraws from the host before it removes any plugin file", async () => {
    const s = setup({ native: record({ ref: `one@${HOST_NAME}`, dependents: [] }) });
    s.withdraw.mockImplementation(() => s.events.push("withdraw"));
    vi.spyOn(s.files, "remove").mockImplementation(async () => {
      s.events.push("removeFiles");
    });

    await s.purge.execute(s.command);

    expect(s.events).toStrictEqual([
      "whileLocked",
      "load",
      "withdraw",
      "removeFiles",
      "forget",
      "save",
    ]);
  });

  it("proves the marketplace under the lock before reading the manifest, and forgets it before saving", async () => {
    const s = setup();

    await s.purge.execute(s.command);

    expect(s.repo.locked).toBe(1);
    expect(s.events).toStrictEqual(["whileLocked", "load", "forget", "save"]);
  });
});
