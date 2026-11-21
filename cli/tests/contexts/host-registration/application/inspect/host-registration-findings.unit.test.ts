import { describe, expect, it } from "vitest";
import {
  pluginFinding,
  sourceFinding,
} from "../../../../../src/contexts/host-registration/application/inspect/host-registration-findings.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const answered = {
  location: "/reg",
  refs: new Map([
    ["on@aidd", { enabled: true }],
    ["off@aidd", { enabled: false }],
  ]),
};

describe("pluginFinding", () => {
  it("says nothing about a plugin that is there and enabled", () => {
    expect(pluginFinding(TOOL.claude, { plugin: "on", ref: "on@aidd" }, answered)).toEqual([]);
  });

  it("reports a plugin the host does not carry", () => {
    expect(pluginFinding(TOOL.claude, { plugin: "x", ref: "x@aidd" }, answered)).toEqual([
      { kind: "plugin-missing", tool: TOOL.claude, ref: "x@aidd", location: "/reg" },
    ]);
  });

  it("reports a plugin the host carries disabled", () => {
    expect(pluginFinding(TOOL.claude, { plugin: "off", ref: "off@aidd" }, answered)).toEqual([
      { kind: "plugin-disabled", tool: TOOL.claude, ref: "off@aidd", location: "/reg" },
    ]);
  });

  it("reports a plugin no ref can be built for", () => {
    expect(pluginFinding(TOOL.claude, { plugin: "x" }, answered)).toEqual([
      { kind: "plugin-unrecorded", tool: TOOL.claude, plugin: "x" },
    ]);
  });
});

describe("sourceFinding", () => {
  it("describes a different catalog under the same name by its plugin difference", () => {
    const finding = sourceFinding(TOOL.claude, {
      name: "aidd",
      location: "/reg",
      registeredSource: "/a",
      requestedSource: "/b",
      registeredIdentity: { name: "aidd", pluginNames: ["a"] },
      requestedIdentity: { name: "aidd", pluginNames: ["b"] },
    });
    expect(finding).toMatchObject({
      kind: "source-conflict",
      name: "aidd",
      registeredSource: "/a",
      requestedSource: "/b",
    });
  });
});
