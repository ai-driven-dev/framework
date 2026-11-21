import { describe, expect, it } from "vitest";
import {
  configAnswers,
  configAssetNamed,
  nativeActivationOf,
  sectionReader,
  settingsOf,
  settingsWrites,
  signalDirectoryOf,
} from "../../../../../src/contexts/tools/domain/profile/profile-answers.js";
import { ConfigSection } from "../../../../../src/contexts/tools/domain/sections/config-section.js";

const settings = new ConfigSection({ outputPath: ".x/settings.json", mergeStrategy: "none" });
const assets = [
  { name: "a.json", content: {}, destination: ".x/a.json", delivery: "install" as const },
  { name: "b.json", content: {}, destination: ".x/b.json", delivery: "runtime" as const },
];

describe("the answers a profile reads from its sections", () => {
  it("reads a declared section, and null for one it does not declare", () => {
    const read = sectionReader({ config: [settings] });

    expect(read("config")).toEqual([settings]);
    expect(read("rules")).toBeNull();
  });

  it("lists the settings files and the writes they stand for", () => {
    expect(settingsOf({ config: [settings] })).toEqual([settings]);
    expect(settingsOf({})).toEqual([]);
    expect(settingsWrites({ config: [settings] })).toEqual([
      { kind: "settings", capability: settings },
    ]);
  });

  it("names no native activation without a native layout", () => {
    expect(nativeActivationOf({})).toBeUndefined();
  });

  it("locates the signal directory under a project root, or none", () => {
    expect(signalDirectoryOf(".x/", "/p")).toEqual({ absolute: "/p/.x/", relative: ".x/" });
    expect(signalDirectoryOf(null, "/p")).toBeNull();
  });
});

describe("the shipped config a profile answers", () => {
  it("finds an asset by name", () => {
    expect(configAssetNamed(assets, "b.json")).toBe(assets[1]);
    expect(configAssetNamed(undefined, "b.json")).toBeUndefined();
  });

  it("keeps runtime files apart from the installed ones, both counting as config files", () => {
    const answers = configAnswers(assets, {});

    expect(answers.configFiles()).toEqual({ "a.json": ".x/a.json", "b.json": ".x/b.json" });
    expect(answers.runtimeFiles()).toEqual({ "b.json": ".x/b.json" });
  });
});
