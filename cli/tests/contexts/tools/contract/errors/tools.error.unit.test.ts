import { describe, expect, it } from "vitest";
import {
  CapabilityConfigError,
  CategoryMismatchError,
  DualConfigError,
  DuplicateToolIdError,
  InvalidAgentFrontmatterError,
  InvalidHooksDescriptorError,
  InvalidMcpServerConfigError,
  InvalidToolProfileError,
  McpServerEditedError,
  TomlParseError,
  UnknownAiToolIdError,
  UnprovenMcpServerDigestError,
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

describe("when an AI tool id is unknown", () => {
  it("carries its data and says nothing itself", () => {
    const error = new UnknownAiToolIdError("zed", ["claude", "cursor"]);
    expect({
      name: error.name,
      tool: error.tool,
      validIds: error.validIds,
      message: error.message,
    }).toStrictEqual({
      name: "UnknownAiToolIdError",
      tool: "zed",
      validIds: ["claude", "cursor"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UnknownAiToolIdError("zed", ["claude", "cursor"]).code).toBe("unknown-ai-tool-id");
  });
});

describe.each([
  [
    "McpServerEditedError",
    (): McpServerEditedError => new McpServerEditedError("db"),
    "mcp-server-edited",
  ],
  [
    "UnprovenMcpServerDigestError",
    (): UnprovenMcpServerDigestError => new UnprovenMcpServerDigestError("db"),
    "unproven-mcp-server-digest",
  ],
])("when %s is raised", (name, build, code) => {
  it("carries its data and says nothing itself", () => {
    const error = build();
    expect({
      name: error.name,
      serverName: error.serverName,
      message: error.message,
    }).toStrictEqual({
      name,
      serverName: "db",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(build().code).toBe(code);
  });
});

describe("when a plugin's category does not match", () => {
  it("carries its data and says nothing itself for an ai category", () => {
    const error = new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]);
    expect({
      name: error.name,
      wrong: error.wrong,
      category: error.category,
      validToolIds: error.validToolIds,
      message: error.message,
    }).toStrictEqual({
      name: "CategoryMismatchError",
      wrong: ["vscode"],
      category: "ai",
      validToolIds: ["claude", "cursor"],
      message: "",
    });
  });

  it("carries its data and says nothing itself for an ide category", () => {
    const error = new CategoryMismatchError(["claude", "cursor"], "ide", ["vscode"]);
    expect({
      name: error.name,
      wrong: error.wrong,
      category: error.category,
      validToolIds: error.validToolIds,
      message: error.message,
    }).toStrictEqual({
      name: "CategoryMismatchError",
      wrong: ["claude", "cursor"],
      category: "ide",
      validToolIds: ["vscode"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new CategoryMismatchError(["vscode"], "ai", ["claude", "cursor"]).code).toBe(
      "category-mismatch"
    );
  });
});

describe("when TomlParseError is raised", () => {
  it("carries its reason and stable code, and says nothing itself", () => {
    const error = new TomlParseError("bad key");
    expect({ reason: error.reason, code: error.code, message: error.message }).toStrictEqual({
      reason: "bad key",
      code: "toml-parse",
      message: "",
    });
  });
});
