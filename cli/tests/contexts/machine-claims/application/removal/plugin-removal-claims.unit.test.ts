import { describe, expect, it } from "vitest";
import {
  machineOwnership,
  sharedSourceReads,
} from "../../../../../src/composition/contexts/machine-claims.js";
import { pluginRemovalClaims } from "../../../../../src/contexts/machine-claims/application/removal/plugin-removal-claims.js";
import type { ListedMarketplace } from "../../../../../src/contexts/machine-claims/ports/marketplace-listing.js";
import type { UserSourceReferences } from "../../../../../src/contexts/machine-claims/ports/user-source-references.js";
import { describeMessage } from "../../../../../src/presentation/errors/describe-message.presenter.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { RecordingSourceReferences } from "../../testing/recording-source-references.fake.js";

const REF = "aidd-test@aidd-framework";
const SHARED: ListedMarketplace = { name: "aidd-framework", scope: "user" };

async function guard(options: {
  references?: UserSourceReferences;
  listed?: readonly ListedMarketplace[];
}) {
  const { references, listed } = options;
  const fs = new InMemoryFileAdapter();
  const claims = pluginRemovalClaims(
    {
      ...machineOwnership(undefined, fs),
      home: "/home/u",
      resolveCacheCandidate: async () => null,
    },
    {
      ...sharedSourceReads({
        fs,
        platform: process.platform,
        references,
      }),
      marketplaceRegistry: listed === undefined ? undefined : { list: async () => listed },
      frameworkMarketplaceName: "aidd-framework",
    }
  );
  const message = await claims.guardMessage({
    binary: "codex",
    tool: registeredTools().aiProfile(TOOL.codex),
    ref: REF,
    marketplaceAlias: "aidd-framework",
    projectRoot: "/project",
  });
  return message === undefined ? undefined : describeMessage(message);
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
