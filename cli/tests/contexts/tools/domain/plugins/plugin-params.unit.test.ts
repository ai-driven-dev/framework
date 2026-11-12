import { describe, expect, it } from "vitest";
import {
  flatHooksParams,
  nativeHooksParams,
} from "../../../../../src/contexts/tools/domain/plugins/plugin-params.js";

const NONE = { kind: "none", reason: "runs no plugin hooks" } as const;

describe("a hooks delivery as the plugin params hold it", () => {
  it("states a native tool that runs none as refusing hooks, with its reason", () => {
    expect(nativeHooksParams(NONE)).toStrictEqual({
      acceptsHooks: false,
      hooksUnsupportedReason: "runs no plugin hooks",
    });
  });

  it("states a flat tool that runs none as refusing hooks, with its reason", () => {
    expect(flatHooksParams(NONE)).toStrictEqual({
      acceptsHooks: false,
      hooksUnsupportedReason: "runs no plugin hooks",
    });
  });

  it("carries a native trust notice and leaves the destination to the plugin", () => {
    expect(nativeHooksParams({ kind: "plugin-file", trustNotice: "trust it" })).toStrictEqual({
      acceptsHooks: true,
      hooksTrustNotice: "trust it",
    });
  });
});
