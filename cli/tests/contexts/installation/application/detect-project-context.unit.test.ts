import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DetectProjectContext } from "../../../../src/contexts/installation/application/detect-project-context.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

const PROJECT_ROOT = "/proj";

describe("DetectProjectContext", () => {
  it("detects typescript via tsconfig.json", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.stack).toBe("typescript");
    expect(ctx.isMonorepo).toBe(false);
    expect(ctx.hasFramework).toBe(false);
  });

  it("detects python via pyproject.toml", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, "pyproject.toml"), "[project]");
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.stack).toBe("python");
  });

  it("detects monorepo via pnpm-workspace.yaml", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'");
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.isMonorepo).toBe(true);
  });

  it("detects monorepo via package.json workspaces field", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(
      join(PROJECT_ROOT, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] })
    );
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.isMonorepo).toBe(true);
    expect(ctx.stack).toBe("typescript");
  });

  it("detects framework via .aidd/manifest.json presence", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, ".aidd/manifest.json"), "{}");
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.hasFramework).toBe(true);
  });

  it("returns unknown stack when no signals match", async () => {
    const fs = new InMemoryFileAdapter({});
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.stack).toBe("unknown");
    expect(ctx.isMonorepo).toBe(false);
    expect(ctx.hasFramework).toBe(false);
  });

  it("reads a project holding only unrelated files as an unknown stack", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, "README.md"), "# hello");
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.stack).toBe("unknown");
  });

  it("does not read a package.json without a workspaces field as a monorepo", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, "package.json"), JSON.stringify({ name: "solo" }));
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.isMonorepo).toBe(false);
  });

  it("describe returns hyphen-readable summary", async () => {
    const fs = new InMemoryFileAdapter({});
    await fs.writeFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");
    await fs.writeFile(join(PROJECT_ROOT, "pnpm-workspace.yaml"), "packages:");
    const detector = new DetectProjectContext(fs);
    const ctx = await detector.execute({ projectRoot: PROJECT_ROOT });
    expect(ctx.describe()).toContain("typescript");
    expect(ctx.describe()).toContain("monorepo");
  });
});
