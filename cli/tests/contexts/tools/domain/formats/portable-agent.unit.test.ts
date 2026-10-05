import { describe, expect, it } from "vitest";
import { portableAgentFrontmatter } from "../../../../../src/contexts/tools/domain/formats/portable-agent.js";
import { InvalidAgentFrontmatterError } from "../../../../../src/kernel/errors.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../../src/kernel/markdown.js";

describe("portableAgentFrontmatter", () => {
  it("names the agent, keeps its description and inherits the session model", () => {
    expect(
      portableAgentFrontmatter(
        { name: "executor", description: "Turns a task into code.", model: "opus" },
        "aidd-dev-executor"
      )
    ).toEqual({
      name: "aidd-dev-executor",
      description: "Turns a task into code.",
      model: "inherit",
    });
  });

  it("turns a comma-separated tools string into a list", () => {
    expect(
      portableAgentFrontmatter({ description: "d", tools: "Read, Grep,Glob" }, "a").tools
    ).toEqual(["Read", "Grep", "Glob"]);
  });

  it("keeps a tools list as a list", () => {
    expect(
      portableAgentFrontmatter({ description: "d", tools: ["Read", "Bash"] }, "a").tools
    ).toEqual(["Read", "Bash"]);
  });

  it("emits no tools key when the source declares none", () => {
    expect(portableAgentFrontmatter({ description: "d" }, "a")).not.toHaveProperty("tools");
  });

  it("drops every key it does not rebuild", () => {
    expect(
      Object.keys(
        portableAgentFrontmatter(
          { description: "d", color: "red", permissionMode: "plan", skills: ["x"] },
          "a"
        )
      ).sort()
    ).toEqual(["description", "model", "name"]);
  });

  it("round-trips a bracketed description and non-string tools as strings", () => {
    const frontmatter = portableAgentFrontmatter(
      { description: "[WIP] foo [x]", tools: [1, true] },
      "a"
    );

    const serialized = serializeFrontmatter(frontmatter, "body");
    const parsed = parseFrontmatter(serialized).frontmatter;

    expect(serialized).toContain("description: '[WIP] foo [x]'");
    expect(parsed.description).toBe("[WIP] foo [x]");
    expect(parsed.tools).toEqual(["1", "true"]);
  });

  it.each([undefined, "", "   "])(
    "refuses a blank description (%j), naming the agent",
    (description) => {
      expect(() => portableAgentFrontmatter({ description }, "aidd-dev-executor")).toThrow(
        InvalidAgentFrontmatterError
      );
      expect(() => portableAgentFrontmatter({ description }, "aidd-dev-executor")).toThrow(
        /aidd-dev-executor/
      );
    }
  );
});
