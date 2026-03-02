import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function dirExists(relativePath: string): boolean {
  return existsSync(resolve(root, relativePath));
}

describe("directory structure", () => {
  const requiredDirs = [
    "src/domain/models",
    "src/domain/ports",
    "src/domain/tool-specs",
    "src/application/use-cases",
    "src/infrastructure/adapters",
    "src/infrastructure/http",
    "src/infrastructure/tar",
    "src/infrastructure/cache",
    "src/infrastructure/auth",
    "src/presentation/commands",
  ];

  for (const dir of requiredDirs) {
    it(`${dir} exists`, () => {
      expect(dirExists(dir)).toBe(true);
    });
  }

  it("src/presentation/presenter.ts exists", () => {
    expect(existsSync(resolve(root, "src/presentation/presenter.ts"))).toBe(true);
  });
});

describe("framework.json fixture", () => {
  const fixturePath = resolve(root, "tests/fixtures/framework.json");
  const descriptor = JSON.parse(readFileSync(fixturePath, "utf-8")) as {
    version: unknown;
    content: Record<string, { directory: string }>;
    templates: unknown;
    config: unknown;
  };

  it("exists and is valid JSON", () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it("has required top-level fields", () => {
    expect(descriptor).toHaveProperty("version");
    expect(descriptor).toHaveProperty("content");
    expect(descriptor).toHaveProperty("templates");
    expect(descriptor).toHaveProperty("config");
  });

  it("content sections have required fields", () => {
    const sections = ["agents", "commands", "rules", "skills"];
    for (const section of sections) {
      expect(descriptor.content).toHaveProperty(section);
      expect(descriptor.content[section]).toHaveProperty("directory");
    }
  });

  it("sample content files exist for each section", () => {
    const contentBase = resolve(root, "tests/fixtures/content");
    const agentFiles = readdirSync(resolve(contentBase, "agents"));
    expect(agentFiles.length).toBeGreaterThanOrEqual(2);

    const skillDirs = readdirSync(resolve(contentBase, "skills"));
    expect(skillDirs.length).toBeGreaterThanOrEqual(2);
  });
});
