import { describe, expect, it } from "vitest";
import {
  listPlacedRules,
  syncRulesListing,
} from "../../../../../../src/contexts/installation/application/materialize/listed-rules/list-placed-rules.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/project";
const AGENTS = "/project/AGENTS.md";
const GLOB = ".kimi-code/instructions/aidd-dev-*.md";

function requestOf(toolId: typeof TOOL.kimi | typeof TOOL.kilo) {
  return { tool: registeredTools().aiProfile(toolId), projectRoot: ROOT };
}

describe("listing the rules a plugin placed", () => {
  it("lists the glob in the file the tool reads, after the team's text", async () => {
    const fs = new InMemoryFileAdapter({ [AGENTS]: "# Team\n" }, [ROOT]);

    await listPlacedRules(fs, requestOf(TOOL.kimi), GLOB);

    expect(fs.getFile(AGENTS)?.startsWith("# Team\n\n")).toBe(true);
    expect(fs.getFile(AGENTS)).toContain(`- \`${GLOB}\``);
  });

  it("writes nothing for a plugin that placed no rule or a tool that lists in its config", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    await listPlacedRules(fs, requestOf(TOOL.kimi), null);
    await listPlacedRules(fs, requestOf(TOOL.kilo), GLOB);

    expect(fs.has(AGENTS)).toBe(false);
  });

  it("refuses a block whose markers do not pair and leaves the file as it was", async () => {
    const broken = "<!-- aidd_plugin_rules:start -->\nhand edit\n";
    const fs = new InMemoryFileAdapter({ [AGENTS]: broken }, [ROOT]);

    await expect(listPlacedRules(fs, requestOf(TOOL.kimi), GLOB)).rejects.toThrow(/repair/);
    expect(fs.getFile(AGENTS)).toBe(broken);
  });
});

describe("bringing the guidance file in line with a plugin's placed files", () => {
  const rule = { relativePath: ".kimi-code/instructions/aidd-dev-1-naming.md" };
  const other = { relativePath: "skills/x/SKILL.md" };
  const index = registeredTools().aiProfile(TOOL.kimi).rulesIndex();
  if (index === null) throw new Error("kimi lists its rules in a guidance file");
  const at = { index, projectRoot: ROOT };

  it("lists the glob when the files hold a rule, and returns the rules", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    const rules = await syncRulesListing(fs, at, { plugin: "aidd-dev", files: [rule, other] });

    expect(rules).toEqual([rule]);
    expect(fs.getFile(AGENTS)).toContain(`- \`${GLOB}\``);
  });

  it("takes the listing out when the files hold no rule any more", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);
    await syncRulesListing(fs, at, { plugin: "aidd-dev", files: [rule] });

    await syncRulesListing(fs, at, { plugin: "aidd-dev", files: [other] });

    expect(fs.has(AGENTS)).toBe(false);
  });
});
