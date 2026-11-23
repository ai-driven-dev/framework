import { describe, expect, it } from "vitest";
import { InvalidManifestDataError } from "../../../../../src/contexts/installation/contract/installation.error.js";
import {
  isV8Manifest,
  splitV8Manifest,
} from "../../../../../src/contexts/installation/domain/manifest/v8-manifest.js";
import {
  resolveRegisteredToolId,
  TOOL,
} from "../../../../shared/testing/registered-tools.builder.js";

const record = {
  binary: "claude",
  marketplaces: [{ alias: "local", hostName: "declared" }],
  pluginRefs: ["plugin@declared"],
  pluginClaims: [{ ref: "plugin@declared", dependents: ["/project-a"] }],
};

const v8 = (tools: Record<string, unknown>) => ({ version: 8, tools });

describe("a v8 manifest, split into its tools and the records they carried", () => {
  it("moves each record out of its entry, the entry keeping the rest", () => {
    const split = splitV8Manifest(
      v8({ claude: { version: "1.0.0", nativeRegistrations: record } }),
      resolveRegisteredToolId
    );

    expect(split.tools).toStrictEqual({ claude: { version: "1.0.0" } });
    expect(split.records).toStrictEqual(new Map([[TOOL.claude, record]]));
  });

  it("holds the record opaque, whatever it carries", () => {
    const opaque = { somethingTheHostAdded: { nested: [1] }, binary: 7 };

    const split = splitV8Manifest(
      v8({ claude: { nativeRegistrations: opaque } }),
      resolveRegisteredToolId
    );

    expect(split.records.get(TOOL.claude)).toStrictEqual(opaque);
  });

  it("records nothing for a tool that carried no record, and keeps its entry as it came", () => {
    const entry = { version: "1.0.0" };

    const split = splitV8Manifest(v8({ cursor: entry }), resolveRegisteredToolId);

    expect(split.tools.cursor).toBe(entry);
    expect(split.records.size).toBe(0);
  });

  it("records nothing under a key no tool resolves to", () => {
    const split = splitV8Manifest(
      v8({ "no-such-tool": { nativeRegistrations: record } }),
      resolveRegisteredToolId
    );

    expect(split.records.size).toBe(0);
  });

  it("refuses a record that is not an object, naming where it is", () => {
    expect(() =>
      splitV8Manifest(v8({ claude: { nativeRegistrations: "claude" } }), resolveRegisteredToolId)
    ).toThrow(
      new InvalidManifestDataError("tools.claude.nativeRegistrations: expected an object.")
    );
  });

  it("copies the record's top level, so the document it came from is not shared", () => {
    const carried: Record<string, unknown> = { binary: "claude" };

    const split = splitV8Manifest(
      v8({ claude: { nativeRegistrations: carried } }),
      resolveRegisteredToolId
    );
    carried.binary = "changed";

    expect(split.records.get(TOOL.claude)?.binary).toBe("claude");
  });

  it.each([
    [8, true],
    [9, false],
    [7, false],
  ])("tells a document of version %s apart: %s", (version, expected) => {
    expect(isV8Manifest({ version, tools: {} })).toBe(expected);
  });
});
