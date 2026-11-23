import { describe, expect, it } from "vitest";
import {
  CapabilityConfigError,
  DualConfigError,
  DuplicateToolIdError,
  InvalidAgentFrontmatterError,
  InvalidHooksDescriptorError,
  InvalidMcpServerConfigError,
  InvalidToolProfileError,
} from "../../../../../src/contexts/tools/contract/errors/tools.error.js";

describe("when CapabilityConfigError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new CapabilityConfigError("cap broke");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "CapabilityConfigError",
      detail: "cap broke",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new CapabilityConfigError("cap broke").code).toBe("capability-config");
  });
});

describe("when DuplicateToolIdError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new DuplicateToolIdError("t");
    expect({ name: error.name, toolId: error.toolId, message: error.message }).toStrictEqual({
      name: "DuplicateToolIdError",
      toolId: "t",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new DuplicateToolIdError("t").code).toBe("duplicate-tool-id");
  });
});

describe("when InvalidAgentFrontmatterError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidAgentFrontmatterError("a", "d");
    expect({
      name: error.name,
      agentName: error.agentName,
      detail: error.detail,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidAgentFrontmatterError",
      agentName: "a",
      detail: "d",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidAgentFrontmatterError("a", "d").code).toBe("invalid-agent-frontmatter");
  });
});

describe("when InvalidHooksDescriptorError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidHooksDescriptorError("t", "unknown-event", "d");
    expect({
      name: error.name,
      toolId: error.toolId,
      invariant: error.invariant,
      detail: error.detail,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidHooksDescriptorError",
      toolId: "t",
      invariant: "unknown-event",
      detail: "d",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidHooksDescriptorError("t", "unknown-event", "d").code).toBe(
      "invalid-hooks-descriptor"
    );
  });
});

describe("when InvalidMcpServerConfigError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidMcpServerConfigError("db");
    expect({
      name: error.name,
      serverName: error.serverName,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidMcpServerConfigError",
      serverName: "db",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMcpServerConfigError("db").code).toBe("invalid-mcp-server-config");
  });
});

describe("when InvalidToolProfileError is raised", () => {
  it("carries its data and says nothing itself", () => {
    const error = new InvalidToolProfileError("t", "unknown-section", "d");
    expect({
      name: error.name,
      toolId: error.toolId,
      invariant: error.invariant,
      detail: error.detail,
      message: error.message,
    }).toStrictEqual({
      name: "InvalidToolProfileError",
      toolId: "t",
      invariant: "unknown-section",
      detail: "d",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidToolProfileError("t", "unknown-section", "d").code).toBe(
      "invalid-tool-profile"
    );
  });
});

describe("when DualConfigError is raised", () => {
  const kilo = "Kilo JSON and JSONC config variants exist at the same location";
  const opencode = "opencode.json and opencode.jsonc exist";

  it("carries its data and says nothing itself", () => {
    const error = new DualConfigError("kilo", kilo);
    expect({
      name: error.name,
      toolId: error.toolId,
      detail: error.detail,
      message: error.message,
    }).toStrictEqual({
      name: "DualConfigError",
      toolId: "kilo",
      detail: kilo,
      message: "",
    });
  });

  it("carries its data and says nothing itself for opencode", () => {
    expect(new DualConfigError("opencode", opencode)).toMatchObject({
      toolId: "opencode",
      detail: opencode,
    });
  });

  it("carries its tool and its stable code", () => {
    const error = new DualConfigError("kilo", kilo);
    expect({ toolId: error.toolId, code: error.code }).toStrictEqual({
      toolId: "kilo",
      code: "dual-config",
    });
  });
});
