import { describe, expect, it, vi } from "vitest";
import {
  RemovePluginsFromMarketplace,
  type RemovePluginsFromMarketplaceRequest,
} from "../../../../../src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { ProjectIntegrationCleanup } from "../../../../../src/contexts/installation/ports/project-integration-cleanup.js";
import { pluginRefRecords } from "../../../../../src/orchestration/plugin/plugin-ref-records.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { REWRITTEN_BINARY, spiedRecordRules } from "../../testing/spy-record-rules.fake.js";

const MARKET = "mkt";
const HOST_NAME = "host-mkt";
const PROJECT = "/proj";

const plugin = (name: string, marketplace = MARKET) =>
  RecordedPlugin.fromJSON({
    name,
    source: { kind: "local", path: `/src/${name}` },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "project",
    marketplace,
  });

function setup(options: { manifest?: Manifest | null; refuse?: Error } = {}) {
  const manifest = options.manifest === undefined ? seeded() : options.manifest;
  const repo = new InMemoryManifestRepository(manifest, PROJECT);
  const calls: string[] = [];
  const cleanup: ProjectIntegrationCleanup = {
    assertLocalIntegrationRemovable: async (_tool, p) => {
      calls.push(`assert:${p.plugin.name}`);
      if (options.refuse !== undefined) throw options.refuse;
    },
    removeLocalIntegration: async (_tool, p, root) => {
      calls.push(`integration:${p.plugin.name}:${root}`);
    },
    deleteLocalFiles: async (_tool, p, root) => {
      calls.push(`files:${p.name}:${root}`);
    },
  };
  const { rules, withoutRef } = spiedRecordRules();
  const removal = new RemovePluginsFromMarketplace(
    { manifestRepo: repo, cleanup },
    registeredTools()
  );
  const useCase = {
    execute: (asked: Command) => removal.execute({ ...asked, records: pluginRefRecords(rules) }),
  };
  return { useCase, repo, calls, withoutRef };
}

function seeded(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addTool(TOOL.cursor, "1.0.0", []);
  manifest.addPlugin(TOOL.claude, plugin("one"));
  manifest.addPlugin(TOOL.claude, plugin("kept", "other"));
  manifest.addPlugin(TOOL.cursor, plugin("two"));
  manifest.setNativeRegistrations(TOOL.claude, {
    binary: "claude",
    marketplaces: [{ alias: MARKET, hostName: HOST_NAME }],
    pluginRefs: [`one@${HOST_NAME}`],
  });
  return manifest;
}

type Command = Omit<RemovePluginsFromMarketplaceRequest, "records">;

const command = (
  confirm: RemovePluginsFromMarketplaceRequest["confirm"] = async () => true
): Command => ({ marketplace: MARKET, projectRoot: PROJECT, confirm });

describe("RemovePluginsFromMarketplace", () => {
  it("answers nothing to remove when no manifest is saved, without asking", async () => {
    const confirm = vi.fn(async () => true);
    const { useCase } = setup({ manifest: null });

    expect(await useCase.execute(command(confirm))).toStrictEqual({
      orphanCount: 0,
      removedCount: 0,
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("does not ask when no plugin came from the marketplace", async () => {
    const confirm = vi.fn(async () => true);
    const { useCase } = setup();

    const result = await useCase.execute({ ...command(confirm), marketplace: "nobody" });

    expect(result).toStrictEqual({ orphanCount: 0, removedCount: 0 });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks once with how many plugins came from the marketplace, in every tool", async () => {
    const confirm = vi.fn(async () => false);
    const { useCase } = setup();

    await useCase.execute(command(confirm));

    expect(confirm).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("removes nothing when the answer is no", async () => {
    const { useCase, repo, calls } = setup();

    const result = await useCase.execute(command(async () => false));

    expect(result).toStrictEqual({ orphanCount: 2, removedCount: 0 });
    expect(calls).toStrictEqual([]);
    expect(repo.saveCount).toBe(0);
  });

  it("checks every plugin can go before removing any", async () => {
    const { useCase, repo, calls } = setup({ refuse: new Error("hand-edited") });

    await expect(useCase.execute(command())).rejects.toThrow("hand-edited");
    expect(calls).toStrictEqual(["assert:one"]);
    expect(repo.saveCount).toBe(0);
  });

  it("removes each plugin's integration and files, then saves the manifest without them", async () => {
    const { useCase, repo, calls } = setup();

    const result = await useCase.execute(command());

    const saved = await repo.load();
    expect(result).toMatchObject({ orphanCount: 2, removedCount: 2 });
    expect(calls).toStrictEqual([
      "assert:one",
      "assert:two",
      `integration:one:${PROJECT}`,
      `files:one:${PROJECT}`,
      `integration:two:${PROJECT}`,
      `files:two:${PROJECT}`,
    ]);
    expect(saved?.getPlugins(TOOL.claude).map((p) => p.name)).toStrictEqual(["kept"]);
    expect(saved?.getPlugins(TOOL.cursor)).toStrictEqual([]);
    expect(repo.saveCount).toBe(1);
  });

  it("drops the removed plugin's host ref from the record and hands back what it left claimed", async () => {
    const { useCase, repo, withoutRef } = setup();

    const result = await useCase.execute(command());

    expect(withoutRef).toHaveBeenCalledExactlyOnceWith(expect.anything(), `one@${HOST_NAME}`);
    expect((await repo.load())?.getNativeRegistrations(TOOL.claude)).toMatchObject({
      binary: REWRITTEN_BINARY,
    });
    expect(result.claims?.nativeRefs).toStrictEqual(new Map([[TOOL.claude, [`one@${HOST_NAME}`]]]));
    expect(result.claims?.plugins.map(({ plugin: p }) => p.name)).toStrictEqual(["one", "two"]);
  });

  it("answers no claims when nothing was removed", async () => {
    const { useCase } = setup();

    expect((await useCase.execute(command(async () => false))).claims).toBeUndefined();
  });
});
