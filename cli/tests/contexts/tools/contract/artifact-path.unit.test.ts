import { describe, expect, it } from "vitest";
import {
  agentsIn,
  artifactPath,
  hooksBridgeFilePath,
  hooksFilePath,
  skillsIn,
} from "../../../../src/contexts/tools/contract/artifact-path.js";
import type {
  ArtifactPlacement,
  SupportedArtifact,
} from "../../../../src/contexts/tools/contract/build-contract.js";
import { flatArtifactLayout } from "../../../../src/shared/domain/materialization/flat-paths.js";

const layout = flatArtifactLayout(".t/", { skills: "nested", agent: { ext: ".md" } });

function placed(placement: ArtifactPlacement): SupportedArtifact {
  return { supported: true, source: { kind: "fullTree", srcDir: "." }, placement };
}

describe("placing an artifact", () => {
  it("places a skill from its layout", () => {
    expect(artifactPath(placed(skillsIn(layout)), "p", "skills/x/SKILL.md")).toBe(
      ".t/skills/p/x/SKILL.md"
    );
  });

  it("places an agent from its layout, named by plugin and file", () => {
    expect(artifactPath(placed(agentsIn(layout)), "p", "agents/a.md")).toBe(".t/agents/p-a.md");
  });

  it("keeps a file's path in its plugin", () => {
    expect(artifactPath(placed({ kind: "relative" }), "p", "x/y")).toBe("x/y");
  });

  it("lands every file at the one shared file", () => {
    expect(artifactPath(placed({ kind: "file", at: ".mcp.json" }), "p", "anything")).toBe(
      ".mcp.json"
    );
  });

  it("swaps the extension of an agent file and drops its folder", () => {
    const toml = placed({ kind: "agentFiles", dir: ".c/agents", ext: ".toml" });

    expect(artifactPath(toml, "p", "agents/a.md")).toBe(".c/agents/a.toml");
  });

  it("puts a hook script in a folder of its plugin and its hooks file beside them", () => {
    const hooks = placed({ kind: "hooks", scriptsDir: ".h/" });

    expect(artifactPath(hooks, "p", "hooks/run.sh")).toBe(".h/p/run.sh");
    expect(artifactPath(hooks, "p", "hooks/p.hooks.json")).toBe(".h/p.hooks.json");
  });

  it("is declared for every artifact: a supported artifact with no placement does not compile", () => {
    // @ts-expect-error placement is required
    const none: SupportedArtifact = { supported: true, source: { kind: "fullTree", srcDir: "." } };

    expect(none.supported).toBe(true);
  });
});

describe("a hooks file and a bridge", () => {
  it("lands a shared hooks file at its one path and an own file beside its directory", () => {
    const merge = () => ({ content: "", warnings: [] });

    expect(hooksFilePath({ at: { shared: ".s/all.json" }, merge }, "p")).toBe(".s/all.json");
    expect(hooksFilePath({ at: { own: ".o/" }, merge }, "p")).toBe(".o/p.hooks.json");
  });

  it("names the bridge after its plugin, in its directory", () => {
    const bridge = { dir: ".b/", skipIfSourceHas: "x.js", generate: () => null };

    expect(hooksBridgeFilePath(bridge, "p")).toBe(".b/p-hooks.js");
  });
});
