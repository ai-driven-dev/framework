import { describe, expect, it } from "vitest";
import {
  findingSeverity,
  UNDECLARED_MARKETPLACE_SEVERITY,
} from "../../../../src/contexts/host-registration/contract/finding-severity.model.js";
import type { HostRegistrationFinding } from "../../../../src/contexts/host-registration/contract/inspect-host-registration-result.js";
import { SYNTHETIC_TOOL } from "../../../shared/testing/synthetic-tool-id.builder.js";

const tool = SYNTHETIC_TOOL;
const found = {
  name: "m",
  registeredSource: "/registered",
  requestedSource: "/requested",
  location: "/settings.json",
};

const cases: [HostRegistrationFinding, string][] = [
  [{ kind: "registry-unanswerable", tool, detail: "d" }, "info"],
  [{ kind: "plugin-unrecorded", tool, plugin: "p" }, "info"],
  [{ kind: "plugin-missing", tool, ref: "p@m", location: "/r" }, "error"],
  [{ kind: "plugin-disabled", tool, ref: "p@m", location: "/r" }, "error"],
  [{ kind: "source-conflict", tool, ...found, pluginDiff: "x" }, "error"],
  [
    {
      kind: "source-drift",
      tool,
      found: {
        ...found,
        drift: { kind: "version-behind", registeredVersion: "2", requestedVersion: "1" },
      },
    },
    "warning",
  ],
  [
    {
      kind: "source-drift",
      tool,
      found: {
        ...found,
        drift: { kind: "unmigrated-foreign-project-source", projectRoot: "/o" },
      },
    },
    "warning",
  ],
  [
    {
      kind: "source-drift",
      tool,
      found: { ...found, drift: { kind: "unmigrated-project-source" } },
    },
    "warning",
  ],
];

describe("how serious a host registry finding is", () => {
  it.each(cases.map(([finding, severity]) => ({ kind: finding.kind, finding, severity })))(
    "grades $kind as $severity",
    ({ finding, severity }) => {
      expect(findingSeverity(finding)).toBe(severity);
    }
  );

  it("grades a marketplace the project no longer declares as a warning", () => {
    expect(UNDECLARED_MARKETPLACE_SEVERITY).toBe("warning");
  });
});
