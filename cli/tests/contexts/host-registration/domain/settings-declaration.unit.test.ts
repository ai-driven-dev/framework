import { describe, expect, it } from "vitest";
import {
  declaredSettingsRefs,
  enabledEntryRef,
  registersByProvenRefs,
  registersBySettingsFile,
  withEnabledPlugins,
  withoutEnabledPlugin,
  withoutMarketplaces,
} from "../../../../src/contexts/host-registration/domain/settings-declaration.js";

const MARKETPLACES = "extraKnownMarketplaces";
const ENABLED = "enabledPlugins";

describe("the marketplaces declaration of a parsed shared file", () => {
  it("is taken out of a copy, the file the caller holds left as it was", () => {
    const shared = { [MARKETPLACES]: { a: {} }, keep: 1 };

    expect(withoutMarketplaces(shared, MARKETPLACES)).toStrictEqual({ keep: 1 });
    expect(shared).toStrictEqual({ [MARKETPLACES]: { a: {} }, keep: 1 });
  });

  it("answers null when the file declares none", () => {
    expect(withoutMarketplaces({ keep: 1 }, MARKETPLACES)).toBeNull();
  });
});

describe("the plugins a parsed shared file enables", () => {
  it("adds the refs not yet enabled to a copy, the file the caller holds left as it was", () => {
    const shared = { [ENABLED]: { "old@m": false }, keep: 1 };

    expect(withEnabledPlugins(shared, ENABLED, ["old@m", "new@m"])).toStrictEqual({
      [ENABLED]: { "old@m": false, "new@m": true },
      keep: 1,
    });
    expect(shared).toStrictEqual({ [ENABLED]: { "old@m": false }, keep: 1 });
  });

  it("answers null when every ref is already enabled", () => {
    expect(withEnabledPlugins({ [ENABLED]: { "a@m": true } }, ENABLED, ["a@m"])).toBeNull();
  });

  it("answers null for a tool that enables no plugin in the shared file", () => {
    expect(withEnabledPlugins({}, null, ["new@m"])).toBeNull();
  });

  it.each([
    ["null", null],
    ["a list", ["x"]],
  ])("starts from an empty map when the value is %s", (_name, value) => {
    expect(withEnabledPlugins({ [ENABLED]: value }, ENABLED, ["p"])).toStrictEqual({
      [ENABLED]: { p: true },
    });
  });
});

const input = (name: string) => ({ name });
const keyOf = (m: { name: string }) => (m.name === "none" ? null : `${m.name}-key`);

describe("the refs a tool's shared file enables for the plugins the manifest records", () => {
  it("keys each ref by the entry key of the marketplace its plugin came from", () => {
    expect(
      declaredSettingsRefs([{ plugin: "p", marketplace: "m" }], [input("m")], keyOf)
    ).toStrictEqual(["p@m-key"]);
  });

  it("skips a plugin with no marketplace, one this sync does not handle and one with no key", () => {
    expect(
      declaredSettingsRefs(
        [
          { plugin: "a", marketplace: null },
          { plugin: "b", marketplace: "unknown" },
          { plugin: "c", marketplace: "none" },
        ],
        [input("none")],
        keyOf
      )
    ).toStrictEqual([]);
  });
});

describe("how a tool's settings file registers its plugins", () => {
  const answering = (proof: boolean) => ({ requiresNativeProof: () => proof });

  it("projects the declared refs for a tool that needs no host proof", () => {
    expect(registersBySettingsFile(answering(false))).toBe(true);
    expect(registersBySettingsFile(answering(true))).toBe(false);
  });

  it("projects only the proven refs for a tool that needs the host's proof", () => {
    expect(registersByProvenRefs(answering(true))).toBe(true);
    expect(registersByProvenRefs(answering(false))).toBe(false);
  });
});

describe("the entry a plugin has in a parsed shared file", () => {
  const entry = "a@m";

  it("is taken out of a copy, the file the caller holds left as it was", () => {
    const shared = { [ENABLED]: { "a@m": true, "b@m": true }, keep: 1 };

    expect(withoutEnabledPlugin(shared, ENABLED, entry)).toStrictEqual({
      [ENABLED]: { "b@m": true },
      keep: 1,
    });
    expect(shared[ENABLED]).toStrictEqual({ "a@m": true, "b@m": true });
  });

  it("answers null when the file holds no entry for it", () => {
    expect(withoutEnabledPlugin({ [ENABLED]: { "b@m": true } }, ENABLED, entry)).toBeNull();
    expect(withoutEnabledPlugin({ keep: 1 }, ENABLED, entry)).toBeNull();
    expect(withoutEnabledPlugin({ [ENABLED]: { "a@m": true } }, null, entry)).toBeNull();
  });
});

describe("the entry that enables a plugin, as its tool wrote it", () => {
  const plugin = { name: "a", marketplace: "alias" };
  const answering = (proof: boolean) => ({ requiresNativeProof: () => proof });

  it("is the ref the host proved for a tool that enables only proven refs", () => {
    expect(enabledEntryRef(answering(true), plugin, "a@hosted")).toBe("a@hosted");
    expect(enabledEntryRef(answering(true), plugin, undefined)).toBeUndefined();
  });

  it("is the plugin on the marketplace's own key for a tool that registers by its settings file", () => {
    expect(enabledEntryRef(answering(false), plugin, "a@hosted")).toBe("a@alias");
  });
});
