import { describe, expect, it } from "vitest";
import {
  assertUserRulesListable,
  syncUserRules,
} from "../../../../../../src/contexts/installation/application/materialize/listed-rules/list-user-rules.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const HOME = "/home/u";
const BASE = `${HOME}/.codex`;
const AGENTS = `${BASE}/AGENTS.md`;
const GLOB = "- `~/.codex/instructions/aidd-craft-*.md`";
const RULES = ["instructions/aidd-craft-1-naming.md", "agents/aidd-craft-planner.toml"];

function listing(files: readonly string[]) {
  return {
    tool: registeredTools().aiProfile(TOOL.codex),
    baseDir: BASE,
    home: HOME,
    plugin: "aidd-craft",
    files: files.map((relativePath) => ({ relativePath })),
  };
}

describe("listing the rules a machine-scope plugin holds", () => {
  it("lists them in the user's AGENTS.md by their path from the home, after the person's own text", async () => {
    const fs = new InMemoryFileAdapter({ [AGENTS]: "# Mine\n" }, [BASE]);

    await syncUserRules(fs, listing(RULES));

    expect(fs.getFile(AGENTS)).toMatch(/^# Mine\n\n<!-- aidd_plugin_rules:start -->/);
    expect(fs.getFile(AGENTS)).toContain(GLOB);
  });

  it("takes the listing out once the plugin holds no rule, the file going when nothing else was in it", async () => {
    const fs = new InMemoryFileAdapter({}, [BASE]);
    await syncUserRules(fs, listing(RULES));

    await syncUserRules(fs, listing(["agents/aidd-craft-planner.toml"]));

    expect(fs.has(AGENTS)).toBe(false);
  });

  it("leaves a plugin that holds none, in a file it never listed, alone", async () => {
    const fs = new InMemoryFileAdapter({}, [BASE]);

    await syncUserRules(fs, listing(["agents/aidd-craft-planner.toml"]));

    expect(fs.has(AGENTS)).toBe(false);
  });

  it("refuses a block whose markers do not pair before anything is written, and says so", async () => {
    const broken = "<!-- aidd_plugin_rules:start -->\nhand edit\n";
    const fs = new InMemoryFileAdapter({ [AGENTS]: broken }, [BASE]);

    await expect(assertUserRulesListable(fs, listing(RULES))).rejects.toThrow(/repair/);
    expect(fs.getFile(AGENTS)).toBe(broken);
  });
});
