import { describe, expect, it } from "vitest";
import type { NativeMarketplaceRegistration } from "../../../../src/contexts/host-registration/domain/native-marketplace-source.js";
import {
  type RegistrationRecord,
  readRegistrationRecord,
  recordedRegistrations,
  registrationRecordData,
} from "../../../../src/contexts/host-registration/domain/registration-record.js";

const registrations: RegistrationRecord = {
  binary: "claude",
  marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
  pluginRefs: ["aidd-context@ai-driven-dev"],
};

describe("registration record: what a tool's own CLI was asked to register", () => {
  it("round-trips the exact effective Codex source while legacy entries remain unproven", () => {
    const proven: RegistrationRecord = {
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

    expect(readRegistrationRecord(registrationRecordData(proven))).toStrictEqual(proven);
    expect(readRegistrationRecord(registrationRecordData(registrations))).toStrictEqual(
      registrations
    );
  });

  describe("serialized", () => {
    it("carries the binary, every marketplace pair and every plugin ref", () => {
      expect(registrationRecordData(registrations)).toStrictEqual({
        binary: "claude",
        marketplaces: [{ alias: "aidd-framework", hostName: "ai-driven-dev" }],
        pluginRefs: ["aidd-context@ai-driven-dev"],
      });
    });
  });

  describe("read", () => {
    it("keeps an absent registration absent", () => {
      expect(readRegistrationRecord(undefined)).toBeUndefined();
    });

    it("reads no registration from data that names no binary", () => {
      expect(readRegistrationRecord({})).toBeUndefined();
    });

    it("reads back the binary, every marketplace pair and every plugin ref", () => {
      expect(
        readRegistrationRecord({
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

  describe("read from hand-edited data", () => {
    it("reads no plugin ref from a pluginRefs that is no list", () => {
      expect(readRegistrationRecord({ binary: "codex", pluginRefs: "a@declared" })).toStrictEqual({
        binary: "codex",
        marketplaces: [],
        pluginRefs: [],
      });
    });

    it("keeps only the plugin refs that are text", () => {
      expect(
        readRegistrationRecord({ binary: "codex", pluginRefs: ["a@declared", 5, null] })?.pluginRefs
      ).toStrictEqual(["a@declared"]);
    });

    it("reads no marketplace from a marketplaces that is no list", () => {
      expect(
        readRegistrationRecord({ binary: "codex", marketplaces: { alias: "a", hostName: "h" } })
      ).toStrictEqual({ binary: "codex", marketplaces: [], pluginRefs: [] });
    });

    it("skips a marketplace entry that is no registration and keeps the others", () => {
      expect(
        readRegistrationRecord({
          binary: "codex",
          marketplaces: [5, { alias: "local", hostName: "declared" }],
        })?.marketplaces
      ).toStrictEqual([{ alias: "local", hostName: "declared" }]);
    });
  });

  it("holds an empty record, naming no binary, for data that names none", () => {
    expect(recordedRegistrations({})).toStrictEqual({
      binary: "",
      marketplaces: [],
      pluginRefs: [],
    });
  });

  it.each(["serialize", "read"])("%s produces an independent ownership snapshot", (action) => {
    const provenance: { kind: "registry"; source: string } = {
      kind: "registry",
      source: "/built",
    };
    const marketplace = { alias: "local", hostName: "declared", provenance };
    const marketplaces: NativeMarketplaceRegistration[] = [marketplace];
    const pluginRefs = ["plugin@declared", "other@declared"];
    const input: RegistrationRecord = { binary: "claude", marketplaces, pluginRefs };
    const expected = structuredClone(input);
    const snapshot =
      action === "serialize" ? registrationRecordData(input) : readRegistrationRecord(input);

    provenance.source = "/foreign";
    marketplace.alias = "changed";
    marketplaces.push({ alias: "extra", hostName: "extra" });
    pluginRefs.push("extra@declared");

    expect(snapshot).toStrictEqual(expected);
  });
});
