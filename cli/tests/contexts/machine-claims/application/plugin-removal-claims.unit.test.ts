import { describe, expect, it } from "vitest";
import { pluginRemovalClaims } from "../../../../src/contexts/machine-claims/application/plugin-removal-claims.js";
import type { ListedMarketplace } from "../../../../src/contexts/machine-claims/ports/marketplace-listing.js";
import type { UserSourceReferences } from "../../../../src/contexts/machine-claims/ports/user-source-references.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { registeredAiProfile, TOOL } from "../../tools/testing/catalog-of.js";
import { RecordingSourceReferences } from "./recording-source-references.js";

const REF = "aidd-test@aidd-framework";
const SHARED: ListedMarketplace = { name: "aidd-framework", scope: "user" };

function guard(options: {
  references?: UserSourceReferences;
  listed?: readonly ListedMarketplace[];
}) {
  const { references, listed } = options;
  const claims = pluginRemovalClaims({
    repo: undefined,
    fs: new InMemoryFileAdapter(),
    logger: new CapturingLogger(),
    home: "/home/u",
    platform: process.platform,
    userSourceReferences: references,
    marketplaceRegistry: listed === undefined ? undefined : { list: async () => listed },
    resolveCacheCandidate: async () => null,
    frameworkMarketplaceName: "aidd-framework",
  });
  return claims.guardMessage(
    "codex",
    registeredAiProfile(TOOL.codex),
    REF,
    "aidd-framework",
    "aidd-framework",
    "/project"
  );
}

describe("the plugin removal guard on the shared source", () => {
  it("names the other projects that still need a ref the host enables machine-wide", async () => {
    const message = await guard({
      references: new RecordingSourceReferences(["/project", "/other"]),
      listed: [SHARED],
    });

    expect(message).toContain(`codex: '${REF}' left enabled`);
    expect(message).toContain("1 other project still references the shared source: /other");
  });

  it("finds the shared source by the alias this project registered it under", async () => {
    const message = await guard({
      references: new RecordingSourceReferences(["/other"]),
      listed: [{ name: "unrelated", scope: "project" }, SHARED],
    });

    expect(message).toContain("left enabled");
  });

  it("lets the removal proceed when no other project references the shared source", async () => {
    const message = await guard({
      references: new RecordingSourceReferences(["/project"]),
      listed: [SHARED],
    });

    expect(message).toBeUndefined();
  });

  it("lets the removal proceed when the source is not the shared one", async () => {
    const message = await guard({
      references: new RecordingSourceReferences(["/other"]),
      listed: [{ name: "aidd-framework", scope: "project" }],
    });

    expect(message).toBeUndefined();
  });

  it("lets the removal proceed when no references file is wired", async () => {
    expect(await guard({ listed: [SHARED] })).toBeUndefined();
  });

  it("lets the removal proceed when no marketplace registry is wired", async () => {
    expect(await guard({ references: new RecordingSourceReferences(["/other"]) })).toBeUndefined();
  });
});
