import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiToolId, IdeToolId, ToolCategory, ToolId } from "../../../src/kernel/tool.js";
import { CLIOutput } from "../../../src/presentation/output.js";
import { createDeps, createMenuDeps } from "../../../src/runtime/wiring/framework.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

describe("createDeps", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("builds the graph once per project root", async () => {
    const first = await createDeps(root, { verbose: false }, undefined, tools);

    expect(await createDeps(root, { verbose: false }, undefined, tools)).toBe(first);
  });

  it("builds a separate graph for another project root", async () => {
    const other = await mkdtemp(join(tmpdir(), "aidd-create-deps-other-"));
    try {
      expect(await createDeps(other, { verbose: false }, undefined, tools)).not.toBe(
        await createDeps(root, { verbose: false }, undefined, tools)
      );
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it("builds a separate graph when a token is given on the command line", async () => {
    expect(await createDeps(root, { verbose: false, token: "ghp_x" }, undefined, tools)).not.toBe(
      await createDeps(root, { verbose: false }, undefined, tools)
    );
  });

  it("builds a separate graph per token", async () => {
    expect(await createDeps(root, { verbose: false, token: "ghp_a" }, undefined, tools)).not.toBe(
      await createDeps(root, { verbose: false, token: "ghp_b" }, undefined, tools)
    );
  });

  it("builds a separate graph for another catalog, and reuses the one for the same catalog", async () => {
    const first = catalogOf();

    const graph = await createDeps(root, { verbose: false }, undefined, first);

    expect(await createDeps(root, { verbose: false }, undefined, first)).toBe(graph);
    expect(await createDeps(root, { verbose: false }, undefined, catalogOf())).not.toBe(graph);
  });

  it("logs through the output it was handed", async () => {
    const output = new CLIOutput(false);
    const withOutput = await mkdtemp(join(tmpdir(), "aidd-create-deps-output-"));
    try {
      expect((await createDeps(withOutput, { verbose: false }, output, tools)).logger).toBe(output);
    } finally {
      await rm(withOutput, { recursive: true, force: true });
    }
  });

  it("reads the catalog it was handed, never one of its own", async () => {
    const real = catalogOf();
    let walked = 0;
    const handed = {
      profile: (id: ToolId) => real.profile(id),
      aiProfile: (id: AiToolId) => real.aiProfile(id),
      ideProfile: (id: IdeToolId) => real.ideProfile(id),
      aiProfileIfAny: (id: ToolId) => real.aiProfileIfAny(id),
      inHelpOrder: (category: ToolCategory) => {
        walked += 1;
        return real.inHelpOrder(category);
      },
      aiIdsInCanonicalOrder: () => real.aiIdsInCanonicalOrder(),
      sortedById: () => real.sortedById(),
    };

    await createDeps(root, { verbose: false }, undefined, handed);

    expect(walked).toBeGreaterThan(0);
  });

  describe("marketplace add --overwrite", () => {
    const source = {
      kind: "local" as const,
      path: join(process.cwd(), "tests/fixtures/framework/marketplace-sample"),
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function registerThenOverwrite(scope: "project" | "user") {
      vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
      const { marketplaceAddUseCase } = await createDeps(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const command = { source, name: "awesome", scope, projectRoot: root, autoTrust: true };
      await marketplaceAddUseCase.execute(command);
      return marketplaceAddUseCase.execute({ ...command, overwrite: true });
    }

    it("removes a project entry through the project remover", async () => {
      await expect(registerThenOverwrite("project")).resolves.toMatchObject({
        marketplace: { name: "awesome", scope: "project" },
      });
    });

    it("removes a user entry through the user remover, which proves ownership first", async () => {
      await expect(registerThenOverwrite("user")).rejects.toThrow(
        "Cannot prove AIDD ownership of user-scope marketplace 'awesome'"
      );
    });
  });

  it("hands the menu a manifest repository rooted at the project", () => {
    expect(createMenuDeps(root).manifestRepo.path).toBe(join(root, ".aidd", "manifest.json"));
  });
});
