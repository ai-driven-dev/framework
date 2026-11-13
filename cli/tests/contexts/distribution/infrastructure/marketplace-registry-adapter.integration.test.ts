import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Marketplace,
  type MarketplaceData,
} from "../../../../src/contexts/distribution/domain/marketplace.js";
import type { MarketplaceRegistryAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-registry-adapter.js";
import { makeRegistryAdapter } from "../testing/registry-adapter.js";

const baseData = (overrides: Partial<MarketplaceData> = {}): MarketplaceData => ({
  name: "awesome",
  source: { kind: "github", repo: "owner/awesome" },
  scope: "project",
  addedAt: "2026-04-28T10:00:00.000Z",
  ...overrides,
});

// What the registry promises whatever holds it is in `ports/marketplace-registry.contract`;
// what stays here is what only a real file can show.
describe("MarketplaceRegistryAdapter", () => {
  let projectRoot: string;
  let configDir: string;
  let userFile: string;
  let adapter: MarketplaceRegistryAdapter;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "marketplace-registry-project-"));
    configDir = await mkdtemp(join(tmpdir(), "marketplace-registry-config-"));
    userFile = join(configDir, "marketplaces.json");
    adapter = makeRegistryAdapter(configDir);
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  // A registry file that exists but holds no list is not an empty registry: `save()` reads
  // that same list, appends and writes the file back, so one silent empty read loses all.
  it("refuses a registry file that carries no list, naming the file rather than crashing", async () => {
    await writeFile(userFile, '{"version":1}', "utf-8");

    await expect(adapter.list(projectRoot)).rejects.toThrow(userFile);
  });

  it("refuses a registry file that is not JSON at all, naming the file", async () => {
    await writeFile(userFile, "not json", "utf-8");

    await expect(adapter.list(projectRoot)).rejects.toThrow(userFile);
  });

  it("reads a registry file whose list is present and empty as an empty registry", async () => {
    await writeFile(userFile, '{"version":1,"marketplaces":[]}', "utf-8");

    await expect(adapter.list(projectRoot)).resolves.toEqual([]);
  });

  it("persists project entries to .aidd/marketplaces.json", async () => {
    const m = Marketplace.fromJSON(baseData());
    await adapter.save(projectRoot, m);

    const raw = await readFile(join(projectRoot, ".aidd", "marketplaces.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ version: 1, marketplaces: [m.toJSON()] });
  });

  it("persists user entries to the user config directory", async () => {
    await adapter.save(projectRoot, Marketplace.fromJSON(baseData({ scope: "user" })));

    expect(JSON.parse(await readFile(userFile, "utf-8")).marketplaces).toHaveLength(1);
  });

  it("loads files written under the current version", async () => {
    await mkdir(join(projectRoot, ".aidd"), { recursive: true });
    await writeFile(
      join(projectRoot, ".aidd", "marketplaces.json"),
      JSON.stringify({ version: 1, marketplaces: [baseData()] })
    );

    expect((await adapter.list(projectRoot)).map((m) => m.name)).toEqual(["awesome"]);
  });
});
