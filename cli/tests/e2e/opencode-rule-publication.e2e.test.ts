import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

describe("OpenCode V2 generated rule publication", () => {
  let env: Awaited<ReturnType<typeof createTestEnv>>;
  const rule = ".opencode/rules/01-standards/1-probe.md";
  const user =
    "User context\r\n<!-- aidd_project_memory:start -->\r\nMemory\r\n<!-- aidd_project_memory:end -->";
  const args = ["framework", "rules", "--tool", "opencode"];

  beforeEach(async () => {
    env = await createTestEnv("opencode-rules");
    await writeFile(join(env.projectDir, "AGENTS.md"), user);
  });
  afterEach(async () => {
    await env.cleanup();
  });

  it.each([".opencode", "opencode.json", "opencode.jsonc"])(
    "supports direct generation with %s and preserves unrelated config",
    async (signal) => {
      if (signal === ".opencode") await mkdir(join(env.projectDir, signal));
      else
        await writeFile(
          join(env.projectDir, signal),
          signal.endsWith("jsonc") ? "// user config\n{}\n" : "{}\n"
        );
      const staged = join(env.tempDir, "staged.md");
      await writeFile(staged, "Exact active rule marker\n");
      const first = await runCli(
        [...args, "--write", rule, "--from", staged],
        env.projectDir,
        env.fakeHome
      );
      expect(first.exitCode, first.stderr).toBe(0);
      const published = await readFile(join(env.projectDir, "AGENTS.md"), "utf8");
      expect(published).toContain(user);
      expect(published).toContain("Exact active rule marker");
      const second = await runCli([...args, "--publish"], env.projectDir, env.fakeHome);
      expect(second.exitCode, second.stderr).toBe(0);
      expect(await readFile(join(env.projectDir, "AGENTS.md"), "utf8")).toBe(published);
      await writeFile(staged, "Changed active rule marker\n");
      expect(
        (await runCli([...args, "--write", rule, "--from", staged], env.projectDir, env.fakeHome))
          .exitCode
      ).toBe(0);
      expect(await readFile(join(env.projectDir, "AGENTS.md"), "utf8")).not.toContain(
        "Exact active rule marker"
      );
      expect(
        (await runCli([...args, "--delete", rule], env.projectDir, env.fakeHome)).exitCode
      ).toBe(0);
      expect(await readFile(join(env.projectDir, "AGENTS.md"), "utf8")).toBe(user);
      if (signal !== ".opencode")
        expect(await readFile(join(env.projectDir, signal), "utf8")).toBe(
          signal.endsWith("jsonc") ? "// user config\n{}\n" : "{}\n"
        );
    }
  );

  it("refuses edited ownership before writing or deleting the source", async () => {
    const staged = join(env.tempDir, "staged.md");
    await writeFile(staged, "Original marker");
    expect(
      (await runCli([...args, "--write", rule, "--from", staged], env.projectDir, env.fakeHome))
        .exitCode
    ).toBe(0);
    const target = join(env.projectDir, "AGENTS.md");
    const edited = (await readFile(target, "utf8")).replace(
      "Original marker",
      "User edited marker"
    );
    await writeFile(target, edited);
    await writeFile(staged, "Replacement marker");
    for (const mutation of [
      ["--write", rule, "--from", staged],
      ["--delete", rule],
    ]) {
      const result = await runCli([...args, ...mutation], env.projectDir, env.fakeHome);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("edited");
      expect(await readFile(join(env.projectDir, rule), "utf8")).toBe("Original marker");
      expect(await readFile(target, "utf8")).toBe(edited);
    }
  });

  it("refuses a rule parent symlink outside the project before any write", async () => {
    const outside = join(env.tempDir, "outside");
    await mkdir(outside);
    await mkdir(join(env.projectDir, ".opencode"));
    await symlink(outside, join(env.projectDir, ".opencode/rules"), "junction");
    const staged = join(env.tempDir, "staged.md");
    await writeFile(staged, "Prospective marker");
    const result = await runCli(
      [...args, "--write", rule, "--from", staged],
      env.projectDir,
      env.fakeHome
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("outside project root");
    expect(await readFile(join(env.projectDir, "AGENTS.md"), "utf8")).toBe(user);
    await expect(readFile(join(outside, "01-standards/1-probe.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects a frontmatter escape on the first staged write", async () => {
    const staged = join(env.tempDir, "frontmatter.md");
    await writeFile(
      staged,
      "---\ndescription: |\n  ```\n---\n<!-- aidd_opencode_rules:end -->\n```\n"
    );
    const result = await runCli(
      [...args, "--write", rule, "--from", staged],
      env.projectDir,
      env.fakeHome
    );
    expect(result.exitCode).not.toBe(0);
    expect(await readFile(join(env.projectDir, "AGENTS.md"), "utf8")).toBe(user);
    await expect(readFile(join(env.projectDir, rule))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
