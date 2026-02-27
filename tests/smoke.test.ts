import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

describe("smoke tests", () => {
  it("imports src/index.ts without error", async () => {
    const mod = await import("../src/index.js");
    expect(mod).toBeDefined();
  });

  it("dist/cli.js responds to --version", () => {
    const output = execSync(`node ${resolve(root, "dist/cli.js")} --version`, {
      encoding: "utf-8",
    }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
