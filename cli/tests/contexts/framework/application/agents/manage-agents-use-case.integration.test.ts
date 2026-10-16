import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManageAgentsUseCase } from "../../../../../src/contexts/framework/application/agents/manage-agents-use-case.js";
import { AgentInstallationStoreAdapter } from "../../../../../src/contexts/framework/infrastructure/agent-installation-store-adapter.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { FileAdapter } from "../../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../../src/runtime/filesystem/hasher-adapter.js";

const sources = {
  "aidd-dev-explorer": "---\nname: explorer\ndescription: Explore\n---\nFind relevant source.",
  "aidd-dev-reviewer": "---\nname: reviewer\ndescription: Review\n---\nReview quality.",
};

describe("ManageAgentsUseCase", () => {
  let root: string;
  let manager: ManageAgentsUseCase;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-agents-"));
    const hasher = new HasherAdapter();
    const fs = new FileAdapter(hasher);
    manager = new ManageAgentsUseCase(fs, new AgentInstallationStoreAdapter(fs), hasher, sources);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("installs namespaced native Codex agents and records ownership", async () => {
    expect(await manager.install({ projectRoot: root, host: "codex", provider: "openai" })).toBe(2);
    const content = await readFile(join(root, ".codex/agents/aidd-dev-explorer.toml"), "utf8");
    expect(content).toContain('model = "gpt-6-luna"');
    expect(content).toContain('model_reasoning_effort = "medium"');
    expect(content).toContain('name = "aidd-dev-explorer"');
    const review = await readFile(join(root, ".codex/agents/aidd-dev-reviewer.toml"), "utf8");
    expect(review).toContain('model = "gpt-6.1-sol"');
    expect(review).toContain('model_reasoning_effort = "medium"');
    expect(
      JSON.parse(await readFile(join(root, ".aidd/agents.json"), "utf8")).codex
    ).toHaveProperty("aidd-dev-explorer");
    expect(await manager.install({ projectRoot: root, host: "codex", provider: "openai" })).toBe(0);
  });

  it("changes provider only for unmodified owned files", async () => {
    await manager.install({ projectRoot: root, host: "opencode", provider: "openai" });
    expect(
      await manager.install({ projectRoot: root, host: "opencode", provider: "anthropic" })
    ).toBe(2);
    expect(await readFile(join(root, ".opencode/agents/aidd-dev-explorer.md"), "utf8")).toContain(
      "anthropic/claude-haiku-5-5#medium"
    );
    expect(await readFile(join(root, ".opencode/agents/aidd-dev-reviewer.md"), "utf8")).toContain(
      "anthropic/claude-opus-5-5#medium"
    );
    await writeFile(join(root, ".opencode/agents/aidd-dev-reviewer.md"), "personal edit");
    await expect(
      manager.install({ projectRoot: root, host: "opencode", provider: "openai" })
    ).rejects.toThrow("modified");
    expect(await readFile(join(root, ".opencode/agents/aidd-dev-explorer.md"), "utf8")).toContain(
      "anthropic/claude-haiku-5-5#medium"
    );
  });

  it("preflights every destination before writing and preserves personal files", async () => {
    await mkdir(join(root, ".codex/agents"), { recursive: true });
    await writeFile(join(root, ".codex/agents/aidd-dev-reviewer.toml"), "personal");
    await expect(
      manager.install({ projectRoot: root, host: "codex", provider: "openai" })
    ).rejects.toThrow("not owned");
    await expect(
      readFile(join(root, ".codex/agents/aidd-dev-explorer.toml"))
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(root, ".aidd/agents.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("removes owned agents, tolerates missing files, and keeps personal agents", async () => {
    await manager.install({ projectRoot: root, host: "codex", provider: "openai" });
    await rm(join(root, ".codex/agents/aidd-dev-reviewer.toml"));
    await writeFile(join(root, ".codex/agents/personal.toml"), "personal");
    expect(await manager.remove({ projectRoot: root, host: "codex" })).toBe(1);
    expect(await readFile(join(root, ".codex/agents/personal.toml"), "utf8")).toBe("personal");
    await expect(readFile(join(root, ".aidd/agents.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await manager.remove({ projectRoot: root, host: "codex" })).toBe(0);
  });

  it("refuses edited owned files before removing any agent", async () => {
    await manager.install({ projectRoot: root, host: "codex", provider: "openai" });
    await writeFile(join(root, ".codex/agents/aidd-dev-reviewer.toml"), "edited");
    await expect(manager.remove({ projectRoot: root, host: "codex" })).rejects.toThrow("modified");
    expect(await readFile(join(root, ".codex/agents/aidd-dev-explorer.toml"), "utf8")).toContain(
      "Explore"
    );
  });

  it("rejects ledger entries outside the bundled agent names", async () => {
    await mkdir(join(root, ".aidd"));
    await writeFile(
      join(root, ".aidd/agents.json"),
      JSON.stringify({ codex: { "../../personal": "a".repeat(32) } })
    );
    await expect(manager.remove({ projectRoot: root, host: "codex" })).rejects.toThrow(
      "Unknown managed agent"
    );
  });

  it.skipIf(process.platform === "win32")(
    "refuses agent and ledger directories pointing outside the project",
    async () => {
      const outside = await mkdtemp(join(tmpdir(), "aidd-agents-outside-"));
      try {
        await symlink(outside, join(root, ".codex"));
        await expect(
          manager.install({ projectRoot: root, host: "codex", provider: "openai" })
        ).rejects.toThrow("outside project");
        await rm(join(root, ".codex"));
        await symlink(outside, join(root, ".aidd"));
        await expect(
          manager.install({ projectRoot: root, host: "codex", provider: "openai" })
        ).rejects.toThrow("outside project");
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    }
  );
});
