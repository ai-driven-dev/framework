import { describe, expect, it } from "vitest";
import {
  type NativeRegistrations,
  type NativeRegistrationsData,
  parseNativeRegistrations,
  toNativeRegistrationsData,
} from "../../../../../src/contexts/framework/domain/manifest/native-registrations.js";

const registrations: NativeRegistrations = {
  binary: "claude",
  marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
  pluginRefs: ["aidd-context@ai-driven-dev"],
};

describe("native registrations — what a tool's own CLI was asked to register", () => {
  it("round-trips the exact effective Codex source while legacy entries remain unproven", () => {
    const proven: NativeRegistrations = {
      binary: "codex",
      marketplaces: [
        {
          alias: "local",
          hostName: "declared",
          provenance: {
            kind: "effective-list",
            root: "/home/.codex/plugins/marketplaces/declared",
            sourceType: "local",
            source: "/project-a/.aidd/cache/built",
          },
        },
      ],
      pluginRefs: [],
    };

    expect(parseNativeRegistrations(toNativeRegistrationsData(proven))).toStrictEqual(proven);
    expect(parseNativeRegistrations(toNativeRegistrationsData(registrations))).toStrictEqual(
      registrations
    );
  });

  describe("serialized", () => {
    it("carries the binary, every marketplace pair and every plugin ref", () => {
      expect(toNativeRegistrationsData(registrations)).toStrictEqual({
        binary: "claude",
        marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });
    });
  });

  describe("parsed", () => {
    it("keeps a registry source without requiring an effective-list root", () => {
      const data: NativeRegistrationsData = {
        binary: "claude",
        marketplaces: [
          {
            alias: "local",
            hostName: "declared",
            provenance: { kind: "registry", source: "/built" },
          },
        ],
        pluginRefs: [],
      };

      expect(parseNativeRegistrations(data)).toStrictEqual(data);
    });

    it.each([
      ["null", null],
      ["scalar", "registry"],
      ["unknown kind", { kind: "unknown", source: "/built" }],
      [
        "unknown kind with effective-list fields",
        { kind: "unknown", source: "/built", root: "/host", sourceType: "local" },
      ],
      ["missing source", { kind: "registry" }],
      ["empty source", { kind: "registry", source: "" }],
      ["non-string source", { kind: "registry", source: 1 }],
      ["missing root", { kind: "effective-list", source: "/built", sourceType: "local" }],
      ["empty root", { kind: "effective-list", source: "/built", sourceType: "local", root: "" }],
      [
        "non-string root",
        { kind: "effective-list", source: "/built", sourceType: "local", root: 1 },
      ],
      ["missing source type", { kind: "effective-list", source: "/built", root: "/host" }],
      [
        "empty source type",
        { kind: "effective-list", source: "/built", root: "/host", sourceType: "" },
      ],
      [
        "non-string source type",
        { kind: "effective-list", source: "/built", root: "/host", sourceType: 1 },
      ],
    ])("leaves %s provenance unproven without dropping the registration", (_name, provenance) => {
      // A persisted manifest is JSON: its provenance may not satisfy the declared type.
      const data = {
        binary: "codex",
        marketplaces: [{ alias: "local", hostName: "declared", provenance }],
        pluginRefs: ["plugin@declared"],
      } as NativeRegistrationsData;

      expect(parseNativeRegistrations(data)).toStrictEqual({
        binary: "codex",
        marketplaces: [{ alias: "local", hostName: "declared" }],
        pluginRefs: ["plugin@declared"],
      });
    });

    it("keeps an absent registration absent", () => {
      expect(parseNativeRegistrations(undefined)).toBeUndefined();
    });

    it("reads back the binary, every marketplace pair and every plugin ref", () => {
      expect(
        parseNativeRegistrations({
          binary: "codex",
          marketplaces: [{ alias: "local", hostName: "declared" }],
          pluginRefs: ["a@declared", "b@declared"],
        })
      ).toStrictEqual({
        binary: "codex",
        marketplaces: [{ alias: "local", hostName: "declared" }],
        pluginRefs: ["a@declared", "b@declared"],
      });
    });
  });

  it.each(["serialize", "parse"] as const)(
    "%s produces an independent ownership snapshot",
    (action) => {
      const dependents = ["/project-a", "/project-b"];
      const provenance = { kind: "registry" as const, source: "/built" };
      const marketplace = { alias: "local", hostName: "declared", provenance };
      const pluginClaims = [{ ref: "plugin@declared", dependents }];
      const input: NativeRegistrationsData = {
        binary: "claude",
        marketplaces: [marketplace],
        pluginRefs: ["plugin@declared", "other@declared"],
        pluginClaims,
      };
      const expected = structuredClone(input);
      const snapshot =
        action === "serialize" ? toNativeRegistrationsData(input) : parseNativeRegistrations(input);

      provenance.source = "/foreign";
      marketplace.alias = "changed";
      input.marketplaces.push({ alias: "extra", hostName: "extra" });
      input.pluginRefs.push("extra@declared");
      pluginClaims[0] = { ref: "changed@declared", dependents: [] };
      dependents.push("/project-c");

      expect(snapshot).toStrictEqual(expected);
    }
  );
});
