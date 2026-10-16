import { access, chmod, mkdir, readFile, readlink, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

describe("agent ownership across CLI processes", () => {
  it
    .skipIf(process.platform === "win32")
    .each([".codex/agents/aidd-dev-reviewer.toml", ".aidd/agents.json"])(
    "refuses a dangling personal symlink at %s before writing agents",
    async (relativePath) => {
      const box = await createTestEnv("agents-dangling-symlink");
      const path = join(box.projectDir, relativePath);
      const target = join(box.projectDir, "personal-missing-file");
      try {
        await mkdir(dirname(path), { recursive: true });
        await symlink(target, path);
        const failed = await runCli(
          ["agents", "install", "--provider", "openai", "--ide", "codex"],
          box.projectDir,
          box.fakeHome
        );
        expect(failed.exitCode).toBe(1);
        expect(await readlink(path)).toBe(target);
        await expect(
          access(join(box.projectDir, ".codex/agents/aidd-dev-explorer.toml"))
        ).rejects.toMatchObject({ code: "ENOENT" });
        if (relativePath !== ".aidd/agents.json")
          await expect(access(join(box.projectDir, ".aidd/agents.json"))).rejects.toMatchObject({
            code: "ENOENT",
          });
      } finally {
        await box.cleanup();
      }
    }
  );

  it("retains both concurrent installations and removes only the selected IDE", async () => {
    const box = await createTestEnv("agents-concurrent");
    const run = (args: string[]) => runCli(args, box.projectDir, box.fakeHome);
    try {
      const installed = await Promise.all([
        run(["agents", "install", "--provider", "openai", "--ide", "codex"]),
        run(["agents", "install", "--provider", "mistral", "--ide", "opencode"]),
      ]);
      for (const result of installed) expect(result.exitCode, result.stderr).toBe(0);
      const ledger = () =>
        readFile(join(box.projectDir, ".aidd/agents.json"), "utf8").then(JSON.parse);
      expect(Object.keys(await ledger()).sort()).toEqual(["codex", "opencode"]);
      const removed = await run(["agents", "remove", "--ide", "codex"]);
      expect(removed.exitCode, removed.stderr).toBe(0);
      expect(Object.keys(await ledger())).toEqual(["opencode"]);
      for (const role of ["explorer", "executor", "validator", "reviewer"]) {
        await access(join(box.projectDir, `.opencode/agents/aidd-dev-${role}.md`));
        await expect(
          access(join(box.projectDir, `.codex/agents/aidd-dev-${role}.toml`))
        ).rejects.toThrow();
      }
      const cleaned = await run(["clean", "--force"]);
      expect(cleaned.exitCode, cleaned.stderr).toBe(0);
      for (const role of ["explorer", "executor", "validator", "reviewer"])
        await expect(
          access(join(box.projectDir, `.opencode/agents/aidd-dev-${role}.md`))
        ).rejects.toThrow();
      await expect(ledger()).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await box.cleanup();
    }
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "leaves no agents when the registry directory refuses writes, then allows retry",
    async () => {
      const box = await createTestEnv("agents-registry-refused");
      const directory = join(box.projectDir, ".aidd");
      const run = () =>
        runCli(
          ["agents", "install", "--provider", "openai", "--ide", "codex"],
          box.projectDir,
          box.fakeHome
        );
      try {
        await mkdir(directory);
        await chmod(directory, 0o555);
        const failed = await run();
        expect(failed.exitCode).toBe(1);
        for (const role of ["explorer", "executor", "validator", "reviewer"])
          await expect(
            access(join(box.projectDir, `.codex/agents/aidd-dev-${role}.toml`))
          ).rejects.toThrow();
        await chmod(directory, 0o755);
        const retried = await run();
        expect(retried.exitCode, retried.stderr).toBe(0);
        await access(join(box.projectDir, ".aidd/agents.json"));
      } finally {
        await chmod(directory, 0o755);
        await box.cleanup();
      }
    }
  );
});
