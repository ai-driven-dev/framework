import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../src/contexts/distribution/contract/marketplace.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { SilentPrompterAdapter } from "../../src/presentation/terminal/silent-prompter.adapter.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";
import {
  aPlugin,
  graphOf,
  SAMPLE_MARKETPLACE,
  stubMachineEnv,
} from "./testing/container-graph.builder.js";

describe("the doctor and clean commands a container wires", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
    stubMachineEnv(root);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("checks every category of an installed project and reports no category it could not check", async () => {
    const { manifestRepo, doctorAllUseCase } = await graphOf(
      root,
      { verbose: false },
      undefined,
      tools
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await manifestRepo.save(manifest);

    const result = await doctorAllUseCase.execute(root);

    expect(result.errors).toEqual([]);
    expect(result.ai?.toolHealth).toEqual([
      { toolId: TOOL.claude, fileCount: 0, mergeFileCount: 0 },
    ]);
  });

  it("counts the token given on the command line as authenticated", async () => {
    const { manifestRepo, doctorUseCase } = await graphOf(
      root,
      { verbose: false, token: "ghp_given" },
      undefined,
      tools
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await manifestRepo.save(manifest);

    const report = await doctorUseCase.execute({ projectRoot: root });

    expect(report.issues.map((issue) => issue.message)).not.toContain("Not authenticated");
  });

  it("purges the machine's built cache and checks each user plugin's files before deleting them", async () => {
    const builtCache = join(root, "user-config", "cache", "built");
    await mkdir(join(builtCache, "1.0.0"), { recursive: true });
    await writeFile(join(builtCache, "1.0.0", "marker"), "");
    const { userManifestRepo, cleanUserScopeUseCase } = await graphOf(
      root,
      { verbose: false },
      undefined,
      tools
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.cursor, "1.0.0", []);
    manifest.addPlugin(TOOL.cursor, aPlugin("user"));
    await userManifestRepo.save(manifest);

    await cleanUserScopeUseCase.execute({ projectRoot: root, force: true });

    expect(existsSync(builtCache)).toBe(false);
  });

  it("refuses a user clean whose host binary cannot be found, naming why", async () => {
    const { userManifestRepo, cleanUserScopeUseCase } = await graphOf(
      root,
      { verbose: false },
      undefined,
      tools
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await userManifestRepo.saveRecords(
      new Map([[TOOL.claude, { binary: "claude", marketplaces: [], pluginRefs: [] }]])
    );
    await userManifestRepo.save(manifest);

    await expect(cleanUserScopeUseCase.execute({ projectRoot: root, force: true })).rejects.toThrow(
      "User clean refused; canonical claims retained."
    );
  });

  it("purges the framework's own registered source on a user clean and keeps another marketplace's", async () => {
    const sources = join(root, "user-config", "cache", "marketplaces");
    await mkdir(join(sources, FRAMEWORK_MARKETPLACE_NAME), { recursive: true });
    await mkdir(join(sources, "awesome"), { recursive: true });
    await writeFile(join(sources, "awesome", "source"), "another marketplace's clone");
    const { cleanUserScopeUseCase } = await graphOf(root, { verbose: false }, undefined, tools);

    await cleanUserScopeUseCase.execute({ projectRoot: root, force: true });

    expect(existsSync(join(sources, FRAMEWORK_MARKETPLACE_NAME))).toBe(false);
    expect(existsSync(join(sources, "awesome"))).toBe(true);
  });

  it("names the framework's shared source when a user clean asks before removing it", async () => {
    const asked = vi.spyOn(SilentPrompterAdapter.prototype, "confirm").mockResolvedValue(false);
    const { cleanUserScopeUseCase } = await graphOf(root, { verbose: false }, undefined, tools);

    await cleanUserScopeUseCase.execute({
      projectRoot: root,
      force: false,
      interactive: true,
    });

    expect(asked).toHaveBeenCalledWith(
      expect.stringContaining(`Remove the shared '${FRAMEWORK_MARKETPLACE_NAME}' source`)
    );
  });

  it("tells a project clean which other projects still reference the framework's shared source, and drops only its own claim", async () => {
    const { registerFrameworkMarketplace, manifestRepo, userSourceReferences, cleanUseCase } =
      await graphOf(root, { verbose: false }, undefined, tools);
    await registerFrameworkMarketplace.execute({
      projectRoot: root,
      pluginSource: { kind: "local", path: SAMPLE_MARKETPLACE },
    });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await manifestRepo.save(manifest);
    const other = join(root, "other-project");
    await mkdir(other, { recursive: true });
    await userSourceReferences.addReference("1.0.0", await realpath(root));
    await userSourceReferences.addReference("1.0.0", await realpath(other));

    const result = await cleanUseCase.execute({ projectRoot: root, force: true });

    expect(result.preview.sharedSourceOtherProjects).toEqual([await realpath(other)]);
    expect(await userSourceReferences.listAllReferencingProjects()).toEqual([
      await realpath(other),
    ]);
  });

  it("refuses a project clean whose plugin's MCP entries cannot be read back", async () => {
    const { manifestRepo, cleanUseCase } = await graphOf(
      root,
      { verbose: false },
      undefined,
      tools
    );
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "1.0.0", []);
    manifest.addPlugin(TOOL.opencode, aPlugin("project", { mcpEntries: { server: "digest" } }));
    await manifestRepo.save(manifest);
    await mkdir(join(root, "opencode.json"));

    await expect(cleanUseCase.execute({ projectRoot: root, force: true })).rejects.toMatchObject({
      code: "EISDIR",
    });
    expect(existsSync(join(root, ".aidd", "manifest.json"))).toBe(true);
  });
});
