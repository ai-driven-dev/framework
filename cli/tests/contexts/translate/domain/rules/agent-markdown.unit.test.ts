import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../src/contexts/tools/contract/build-contract.js";
import { agentContent } from "../../../../../src/contexts/translate/domain/rules/agent-markdown.js";

type Supported = Extract<ArtifactContract, { supported: true }>;

const SOURCE = "---\nname: x\nmodel: opus\n---\nSee @./y.md\n";
const base: Supported = {
  supported: true,
  source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
  path: (_plugin, rel) => rel,
};
const at = { plugin: "p", outName: "x.md", from: "agents/x.md" };

describe("agentContent", () => {
  it("writes the frontmatter the tool keeps and reads the links of the body", () => {
    const artifact: Supported = {
      ...base,
      agentMarkdown: { frontmatter: (fm, of) => ({ name: `${of.plugin}-${fm.name}` }) },
    };

    expect(agentContent(SOURCE, artifact, { ...at, unshaped: "carry" })).toBe(
      "---\nname: 'p-x'\n---\nSee [y.md](./y.md)\n"
    );
  });

  it("writes double quotes when the tool keeps single ones literally", () => {
    const artifact: Supported = {
      ...base,
      agentMarkdown: { frontmatter: (fm) => fm, quote: "double" },
    };

    expect(agentContent(SOURCE, artifact, { ...at, unshaped: "carry" })).toContain('name: "x"');
  });

  it("hands the whole conversion to a tool whose agent is no markdown", () => {
    const artifact: Supported = { ...base, transform: (content, plugin) => `${plugin}:${content}` };

    expect(agentContent("c", artifact, { ...at, unshaped: "links" })).toBe("p:c");
  });

  it("carries an agent the tool shapes in no way when asked to", () => {
    expect(agentContent(SOURCE, base, { ...at, unshaped: "carry" })).toBe(SOURCE);
  });

  it("reads only the links of an agent the tool shapes in no way when asked to", () => {
    expect(agentContent(SOURCE, base, { ...at, unshaped: "links" })).toBe(
      "---\nname: 'x'\nmodel: 'opus'\n---\nSee [y.md](./y.md)\n"
    );
  });
});
