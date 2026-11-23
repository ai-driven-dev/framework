import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { FileHash } from "../../src/shared/domain/file-hash.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";
import { containerOf, stubMachineEnv } from "./testing/container-graph.builder.js";

const FRAMEWORK = join(process.cwd(), "tests/fixtures/framework");
const SETTINGS = ".claude/settings.json";

describe("removing a plugin and its marketplace", () => {
  let root: string;
  let project: string;
  let container: Awaited<ReturnType<typeof containerOf>>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-removal-"));
    stubMachineEnv(root);
    project = join(root, "project");
    await mkdir(project, { recursive: true });
    container = await containerOf(project, { verbose: false }, undefined, catalogOf());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await container.shared.manifestRepo.save(manifest);
    await container.marketplace.addMarketplace.execute({
      source: { kind: "local", path: FRAMEWORK },
      name: "local",
      scope: "project",
      projectRoot: project,
      autoTrust: true,
      overwrite: false,
    });
    await container.plugin.installPlugin.execute({
      pluginArg: "aidd-test",
      toolIds: [TOOL.claude],
      projectRoot: project,
      interactive: false,
      fromMarketplace: "local",
      yes: true,
      scope: undefined,
    });
    await container.marketplace.syncNativeActivation.execute({
      projectRoot: project,
      marketplaceNames: ["local"],
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  const exists = (path: string) =>
    access(join(project, path)).then(
      () => true,
      () => false
    );

  it("leaves no enabled-plugin entry once the plugin is removed", async () => {
    const before = JSON.parse(await readFile(join(project, SETTINGS), "utf8"));
    expect(before.enabledPlugins).toHaveProperty("aidd-test@local");

    await container.plugin.removePlugin.execute({
      pluginName: "aidd-test",
      toolIds: "all",
      projectRoot: project,
    });

    const content = await readFile(join(project, SETTINGS), "utf8");
    expect(JSON.parse(content).enabledPlugins ?? {}).not.toHaveProperty("aidd-test@local");
    const manifest = await container.shared.manifestRepo.load();
    const tracked = manifest?.getToolFiles(TOOL.claude).find((f) => f.relativePath === SETTINGS);
    expect(tracked?.hash.toString()).toBe(FileHash.of(content).toString());
  });

  it("leaves no built cache once the marketplace is removed", async () => {
    expect(await exists(".aidd/cache/built/local")).toBe(true);

    await container.marketplace.removeProjectMarketplace.execute({
      name: "local",
      projectRoot: project,
      autoConfirm: true,
    });

    expect(await exists(".aidd/cache/built/local")).toBe(false);
  });
});
