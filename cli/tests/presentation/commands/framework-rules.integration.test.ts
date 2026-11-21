import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOOL } from "../../shared/testing/catalog-of.builder.js";
import { createTestEnv } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("framework-rules"));
});

afterEach(async () => {
  await cleanup();
});

describe("aidd framework rules, the inventory a rule scan reads", () => {
  it("answers with every rule installed, whatever tool installed it", async () => {
    await mkdir(join(project, ".claude/rules/01-standards"), { recursive: true });
    await mkdir(join(project, ".codex/rules"), { recursive: true });
    await mkdir(join(project, ".cursor/rules"), { recursive: true });
    await writeFile(
      join(project, ".claude/rules/01-standards/1-naming.md"),
      '---\ndescription: Names files\npaths:\n  - "src/**/*.ts"\n---\n\n# Naming\n'
    );
    await writeFile(join(project, ".codex/rules/2-imports.md"), "---\n---\n\n# Imports\n");
    // Beside a rule, and not one: only the extension the tool installs makes it a rule.
    await writeFile(join(project, ".cursor/rules/README.md"), "# not a rule\n");

    const { stdout, exitCode } = await runInProcess(["framework", "rules", "--json"], {
      cwd: project,
      home,
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual([
      {
        tool: TOOL.claude,
        path: ".claude/rules/01-standards/1-naming.md",
        name: "1-naming",
        description: "Names files",
        paths: ["src/**/*.ts"],
      },
      { tool: TOOL.codex, path: ".codex/rules/2-imports.md", name: "2-imports", description: "" },
    ]);
  });
});
