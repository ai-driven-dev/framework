import { describe, expect, it } from "vitest";
import { buildTargetModesOf } from "../../../../src/contexts/translate/domain/build-target.js";
import { aCatalog, anEmptyContract, aProfile } from "../../tools/testing/profiles.js";

describe("buildTargetModesOf", () => {
  it("gives a tool one pair per contract it declares, and none for what it omits", () => {
    const catalog = aCatalog(
      aProfile("claude")
        .withBuildContract("marketplace", anEmptyContract())
        .withBuildContract("flat", anEmptyContract())
        .build(),
      aProfile("opencode").withBuildContract("flat", anEmptyContract()).build()
    );

    expect(buildTargetModesOf(catalog.getAllRegisteredTools())).toEqual([
      { target: "claude", mode: "marketplace" },
      { target: "claude", mode: "flat" },
      { target: "opencode", mode: "flat" },
    ]);
  });

  it("excludes a registered tool that declares no build contract at all", () => {
    const catalog = aCatalog(aProfile("cursor").withoutBuildContracts().build());

    expect(buildTargetModesOf(catalog.getAllRegisteredTools())).toEqual([]);
  });
});
