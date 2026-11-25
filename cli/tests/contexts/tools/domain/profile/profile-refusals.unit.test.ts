import { describe, expect, it } from "vitest";
import { InvalidToolProfileError } from "../../../../../src/contexts/tools/contract/errors/tools.error.js";
import {
  refuseDirectory,
  refuseDisagreeingPlugin,
  refuseDisagreeingShippedConfig,
  refuseUnknownSections,
  refuseWithoutBuildContract,
} from "../../../../../src/contexts/tools/domain/profile/profile-refusals.js";
import { ConfigSection } from "../../../../../src/contexts/tools/domain/sections/config-section.js";
import { anEmptyContract } from "../../../../shared/testing/empty-build-contract.builder.js";
import { flatPlugins, nativePlugins, sectionsOf } from "../../testing/plugin-mode.builder.js";

const settings = new ConfigSection({ outputPath: ".x/settings.json", mergeStrategy: "none" });

function refusalOf(refuse: () => void): InvalidToolProfileError {
  try {
    refuse();
  } catch (error) {
    if (error instanceof InvalidToolProfileError) return error;
    throw error;
  }
  throw new Error("nothing was refused");
}

describe("a profile directory", () => {
  it("must be relative and end with a slash", () => {
    expect(refusalOf(() => refuseDirectory("x", "/abs/")).invariant).toBe("directory-not-relative");
    expect(refusalOf(() => refuseDirectory("x", ".x")).invariant).toBe(
      "directory-without-trailing-slash"
    );
    expect(() => refuseDirectory("x", ".x/")).not.toThrow();
  });
});

describe("a profile's sections and build contracts", () => {
  it("refuses a section key no tool can declare", () => {
    const sections = { config: [settings], bogus: 1 };

    expect(refusalOf(() => refuseUnknownSections("x", sections)).detail).toBe(
      "'bogus' is no section."
    );
  });

  it("asks for a marketplace or a flat build contract", () => {
    expect(refusalOf(() => refuseWithoutBuildContract("x", {})).invariant).toBe(
      "no-build-contract"
    );
    expect(() => refuseWithoutBuildContract("x", { flat: () => anEmptyContract() })).not.toThrow();
  });
});

describe("plugin sections that disagree", () => {
  const native = nativePlugins();
  const flat = flatPlugins("refuses");
  const detailOf = (sections: object) =>
    refusalOf(() => refuseDisagreeingPlugin("x", sections)).detail;

  it("refuses a native layout without a manifest", () => {
    expect(detailOf({ layout: native.layout, hooks: native.hooks })).toBe(
      "a native layout requires a manifest section."
    );
  });

  it("refuses a manifest beside a flat layout, or beside no layout", () => {
    expect(detailOf({ ...sectionsOf(flat), manifest: native.manifest })).toBe(
      "a flat layout takes no manifest section."
    );
    expect(detailOf({ manifest: native.manifest })).toBe("a manifest needs a native layout.");
  });

  it("refuses a layout with no hooks section, or a delivery it cannot take", () => {
    expect(detailOf({ layout: flat.layout })).toBe(
      "a layout requires a hooks section to state its delivery."
    );
    const bridge = { delivery: { kind: "bridge", flat: { dir: ".x/hooks/" } } } as const;
    expect(detailOf({ ...sectionsOf(native), hooks: bridge })).toBe(
      "hooks delivery 'bridge' does not suit a native layout."
    );
  });

  it("accepts a coherent declaration", () => {
    expect(() => refuseDisagreeingPlugin("x", sectionsOf(native))).not.toThrow();
  });
});

describe("shipped config", () => {
  const shipped = (destination: string, delivery: "install" | "section") => ({
    name: "settings.json",
    content: {},
    destination,
    delivery,
  });

  it("refuses a name declared twice", () => {
    const assets = [shipped(".x/a.json", "install"), shipped(".x/b.json", "install")];

    expect(refusalOf(() => refuseDisagreeingShippedConfig("x", assets, {})).detail).toBe(
      "'settings.json' is shipped twice."
    );
  });

  it("refuses a section file no settings section writes", () => {
    const assets = [shipped(".x/elsewhere.json", "section")];

    expect(
      refusalOf(() => refuseDisagreeingShippedConfig("x", assets, { config: [settings] })).detail
    ).toContain("which no settings section writes");
    expect(() =>
      refuseDisagreeingShippedConfig("x", [shipped(".x/settings.json", "section")], {
        config: [settings],
      })
    ).not.toThrow();
  });
});
