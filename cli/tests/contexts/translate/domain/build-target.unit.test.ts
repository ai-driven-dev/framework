import { describe, expect, it } from "vitest";
import {
  buildTargetModesOf,
  supportedBuildTargets,
} from "../../../../src/contexts/translate/domain/build-target.js";
import { catalogOf } from "../../tools/testing/catalog-of.js";
import { anEmptyContract, aProfile } from "../../tools/testing/profiles.js";

describe("buildTargetModesOf", () => {
  it("gives a tool one pair per contract it declares, and none for what it omits", () => {
    const catalog = catalogOf([
      aProfile("claude")
        .withBuildContract("marketplace", anEmptyContract())
        .withBuildContract("flat", anEmptyContract())
        .build(),
      aProfile("opencode").withBuildContract("flat", anEmptyContract()).build(),
    ]);

    expect(buildTargetModesOf(catalog)).toEqual([
      { target: "claude", mode: "marketplace" },
      { target: "claude", mode: "flat" },
      { target: "opencode", mode: "flat" },
    ]);
  });
});

describe("supportedBuildTargets", () => {
  it("lists the registered targets in the shared tool order, which the usage message prints", () => {
    expect(supportedBuildTargets(catalogOf())).toEqual([
      "claude",
      "cursor",
      "copilot",
      "opencode",
      "kilo",
      "codex",
      "antigravity",
    ]);
  });
});
