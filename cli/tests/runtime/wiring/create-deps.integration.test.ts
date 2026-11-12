import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AiToolId, ToolCategory, ToolId } from "../../../src/kernel/tool.js";
import { CLIOutput } from "../../../src/presentation/output.js";
import { createDeps, createMenuDeps } from "../../../src/runtime/wiring/framework.js";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

describe("createDeps", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("builds the graph once per project root", async () => {
    const first = await createDeps(root, { verbose: false });

    expect(await createDeps(root, { verbose: false })).toBe(first);
  });

  it("builds a separate graph for another project root", async () => {
    const other = await mkdtemp(join(tmpdir(), "aidd-create-deps-other-"));
    try {
      expect(await createDeps(other, { verbose: false })).not.toBe(
        await createDeps(root, { verbose: false })
      );
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it("builds a separate graph when a token is given on the command line", async () => {
    expect(await createDeps(root, { verbose: false, token: "ghp_x" })).not.toBe(
      await createDeps(root, { verbose: false })
    );
  });

  it("builds a separate graph per token", async () => {
    expect(await createDeps(root, { verbose: false, token: "ghp_a" })).not.toBe(
      await createDeps(root, { verbose: false, token: "ghp_b" })
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
      expect((await createDeps(withOutput, { verbose: false }, output)).logger).toBe(output);
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
      inHelpOrder: (category: ToolCategory) => real.inHelpOrder(category),
      sortedById: () => {
        walked += 1;
        return real.sortedById();
      },
    };

    await createDeps(root, { verbose: false }, undefined, handed);

    expect(walked).toBeGreaterThan(0);
  });

  it("hands the menu a manifest repository rooted at the project", () => {
    expect(createMenuDeps(root).manifestRepo.path).toBe(join(root, ".aidd", "manifest.json"));
  });
});
