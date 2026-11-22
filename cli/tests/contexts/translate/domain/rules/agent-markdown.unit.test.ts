import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../src/contexts/tools/contract/build-contract.js";
import {
  agentContent,
  agentLinks,
} from "../../../../../src/contexts/translate/domain/rules/agent-markdown.js";

type Supported = Extract<ArtifactContract, { supported: true }>;

const SOURCE = "---\nname: x\nmodel: opus\n---\nSee @./y.md\n";
const base: Supported = {
  supported: true,
  source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
  placement: { kind: "relative" },
};
const at = { plugin: "p", outName: "x.md", from: "agents/x.md" };

describe("writing an agent's content", () => {
  it("writes the frontmatter the tool keeps and leaves the links to the plan", () => {
    const artifact: Supported = {
      ...base,
      agentMarkdown: { frontmatter: (fm, of) => ({ name: `${of.plugin}-${fm.name}` }) },
    };

    expect(agentContent(SOURCE, artifact, { ...at, unshaped: "carry" })).toBe(
      "---\nname: 'p-x'\n---\nSee @./y.md\n"
    );
  });

  it("writes double quotes when the tool keeps single ones literally", () => {
    const artifact: Supported = {
      ...base,
      agentMarkdown: { frontmatter: (fm) => fm, quote: "double" },
    };

    expect(agentContent(SOURCE, artifact, { ...at, unshaped: "carry" })).toContain('name: "x"');
  });

  it("names an agent after its plugin and file when the tool asks, whatever the source called it", () => {
    const artifact: Supported = {
      ...base,
      agentMarkdown: { frontmatter: (fm) => ({ name: fm.name }), pluginPrefixedName: true },
    };

    expect(agentContent(SOURCE, artifact, { ...at, unshaped: "carry" })).toContain("name: 'p-x'");
    expect(
      agentContent(SOURCE, artifact, { ...at, outName: "y.agent.md", unshaped: "carry" })
    ).toContain("name: 'p-y'");
  });

  it("keeps the source's name when the tool does not ask", () => {
    const artifact: Supported = { ...base, agentMarkdown: { frontmatter: (fm) => fm } };

    expect(agentContent(SOURCE, artifact, { ...at, unshaped: "carry" })).toContain("name: 'x'");
  });

  it("hands the whole conversion to a tool whose agent is no markdown", () => {
    const artifact: Supported = { ...base, transform: (content, plugin) => `${plugin}:${content}` };

    expect(agentContent("c", artifact, { ...at, unshaped: "links" })).toBe("p:c");
  });

  it("carries an agent the tool shapes in no way when asked to", () => {
    expect(agentContent(SOURCE, base, { ...at, unshaped: "carry" })).toBe(SOURCE);
  });

  it("writes an agent the tool shapes in no way with the frontmatter quoted when asked to read its links", () => {
    expect(agentContent(SOURCE, base, { ...at, unshaped: "links" })).toBe(
      "---\nname: 'x'\nmodel: 'opus'\n---\nSee @./y.md\n"
    );
  });
});

describe("reading an agent's links", () => {
  it("reads the links from where the layout puts the agent", () => {
    expect(agentLinks(base, { ...at, unshaped: "links" })).toEqual({
      kind: "relative",
      currentFilePluginRelative: "agents/x.md",
      resolveTargetPath: undefined,
    });
  });

  it("reads none of an agent carried as it is", () => {
    expect(agentLinks(base, { ...at, unshaped: "carry" })).toBeUndefined();
  });

  it("reads none of an agent a tool converts whole", () => {
    expect(
      agentLinks({ ...base, transform: (c) => c }, { ...at, unshaped: "links" })
    ).toBeUndefined();
  });

  it("reads the links of an agent whose frontmatter the tool shapes", () => {
    const shaped: Supported = { ...base, agentMarkdown: { frontmatter: (fm) => fm } };
    expect(agentLinks(shaped, { ...at, unshaped: "carry" })?.kind).toBe("relative");
  });
});
