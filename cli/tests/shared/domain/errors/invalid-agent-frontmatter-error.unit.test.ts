import { describe, expect, it } from "vitest";
import { InvalidAgentFrontmatterError } from "../../../../src/shared/domain/errors/invalid-agent-frontmatter-error.js";

describe("InvalidAgentFrontmatterError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidAgentFrontmatterError("a", "d");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidAgentFrontmatterError",
      message: "Agent 'a' has invalid frontmatter: d.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidAgentFrontmatterError("a", "d").code).toBe("invalid-agent-frontmatter");
  });
});
