import { describe, expect, it } from "vitest";
import {
  CapabilityConfigError,
  DualConfigError,
  DuplicateToolIdError,
  InvalidAgentFrontmatterError,
  InvalidHooksDescriptorError,
  InvalidMcpServerConfigError,
  InvalidToolProfileError,
  ToolListMismatchError,
} from "../../../../src/contexts/tools/domain/tools.error.js";

describe("CapabilityConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new CapabilityConfigError("cap broke");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CapabilityConfigError",
      message: "cap broke",
    });
  });

  it("carries its stable code", () => {
    expect(new CapabilityConfigError("cap broke").code).toBe("capability-config");
  });
});

describe("DuplicateToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new DuplicateToolIdError("t");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "DuplicateToolIdError",
      message: "Tool 't' is registered twice.",
    });
  });

  it("carries its stable code", () => {
    expect(new DuplicateToolIdError("t").code).toBe("duplicate-tool-id");
  });
});

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

describe("InvalidHooksDescriptorError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidHooksDescriptorError("t", "unknown-event", "d");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidHooksDescriptorError",
      message: "The hooks descriptor of 't' breaks 'unknown-event': d",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidHooksDescriptorError("t", "unknown-event", "d").code).toBe(
      "invalid-hooks-descriptor"
    );
  });
});

describe("InvalidMcpServerConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidMcpServerConfigError("db");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidMcpServerConfigError",
      message: 'MCP server "db" must have either a "command" or "url" field',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMcpServerConfigError("db").code).toBe("invalid-mcp-server-config");
  });
});

describe("InvalidToolProfileError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidToolProfileError("t", "unknown-section", "d");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidToolProfileError",
      message: "The profile of 't' breaks 'unknown-section': d",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidToolProfileError("t", "unknown-section", "d").code).toBe(
      "invalid-tool-profile"
    );
  });
});

describe("DualConfigError", () => {
  const kilo = "Kilo JSON and JSONC config variants exist at the same location";
  const opencode = "opencode.json and opencode.jsonc exist";

  it("says exactly what went wrong for kilo", () => {
    const error = new DualConfigError("kilo", kilo);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "DualConfigError",
      message: "Both Kilo JSON and JSONC config variants exist at the same location. Remove one.",
    });
  });

  it("says exactly what went wrong for opencode", () => {
    expect(new DualConfigError("opencode", opencode).message).toBe(
      "Both opencode.json and opencode.jsonc exist. Remove one."
    );
  });

  it("carries its tool and its stable code", () => {
    const error = new DualConfigError("kilo", kilo);
    expect({ toolId: error.toolId, code: error.code }).toStrictEqual({
      toolId: "kilo",
      code: "dual-config",
    });
  });
});

describe("ToolListMismatchError", () => {
  it("says exactly what went wrong", () => {
    const error = new ToolListMismatchError(["a", "b"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolListMismatchError",
      message: "Tool lists differ on: a, b.",
    });
  });

  it("carries its stable code", () => {
    expect(new ToolListMismatchError(["a", "b"]).code).toBe("tool-list-mismatch");
  });
});
