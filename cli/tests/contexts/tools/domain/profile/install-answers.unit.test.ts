import { describe, expect, it } from "vitest";
import { catalogOf } from "../../testing/catalog-of.js";

function aiProfile(id: "claude" | "opencode" | "copilot" | "antigravity") {
  const profile = catalogOf().profile(id);
  if (profile.kind !== "ai") throw new Error(`${id} is not an AI tool`);
  return profile;
}

describe("what an install asks a tool profile", () => {
  describe("the config files it writes", () => {
    it("lists a tool's own config files then the runtime modules its plugins need", () => {
      const files = aiProfile("opencode").configFiles();

      expect(Object.entries(files)).toEqual([
        ["opencode.json", "opencode.json"],
        ["opencode-events.js", ".opencode/hooks/opencode-events.js"],
      ]);
    });

    it("lists only its own config files for a tool with no runtime module", () => {
      const claude = aiProfile("claude");

      expect(claude.configFiles()).toEqual({ "settings.json": ".claude/settings.json" });
      expect(claude.runtimeFiles()).toEqual({});
    });

    it("lists the runtime modules apart from the config files", () => {
      expect(aiProfile("opencode").runtimeFiles()).toEqual({
        "opencode-events.js": ".opencode/hooks/opencode-events.js",
      });
    });
  });

  describe("the mcp file", () => {
    it("answers a tool that declares one", () => {
      expect(aiProfile("opencode").mcpConfig()?.outputPath()).toBe("opencode.json");
    });

    it("answers null for a tool that declares none", () => {
      expect(aiProfile("antigravity").mcpConfig()).toBeNull();
    });
  });

  describe("the settings files", () => {
    it("lists each settings file a tool declares", () => {
      const catalog = catalogOf();

      expect(aiProfile("copilot").settingsFiles().length).toBeGreaterThan(0);
      expect(catalog.profile("vscode").kind).toBe("ide");
      expect(catalog.profile("vscode").settingsFiles().length).toBeGreaterThan(0);
    });

    it("lists none for a tool that declares none", () => {
      expect(aiProfile("opencode").settingsFiles()).toEqual([]);
    });
  });

  describe("the machine-local files", () => {
    it("lists what the tool's marketplace registration keeps on the machine", () => {
      expect(aiProfile("claude").machineLocalFiles()).toEqual([".claude/settings.local.json"]);
    });

    it("lists none for a tool whose registration keeps no file of its own", () => {
      expect(aiProfile("copilot").machineLocalFiles()).toEqual([]);
      expect(aiProfile("opencode").machineLocalFiles()).toEqual([]);
    });
  });

  describe("the content sections", () => {
    it("answers whether a markdown section takes a file by its tool suffix", () => {
      const agents = aiProfile("claude").markdownSection("agents");

      expect(agents?.acceptsFileName("reviewer.claude.md")).toBe(true);
      expect(agents?.acceptsFileName("reviewer.cursor.md")).toBe(false);
    });

    it("answers whether the skills section takes a file by its tool suffix", () => {
      const skills = aiProfile("claude").skillsSection();

      expect(skills?.acceptsFileName("hello.claude.md")).toBe(true);
      expect(skills?.acceptsFileName("hello.cursor.md")).toBe(false);
    });

    it("answers where the skills section lands a built file", () => {
      expect(aiProfile("claude").skillsSection()?.buildInstallPath("hello.claude.md")).toBe(
        ".claude/skills/hello.md"
      );
    });
  });
});
