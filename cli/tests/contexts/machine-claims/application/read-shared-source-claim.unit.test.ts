import { describe, expect, it } from "vitest";
import { readSharedSourceClaim } from "../../../../src/contexts/machine-claims/application/read-shared-source-claim.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { RecordingSourceReferences } from "../testing/recording-source-references.fake.js";

const SHARED: { name: string; scope: Scope } = { name: "aidd-framework", scope: "user" };

function reader(references?: RecordingSourceReferences) {
  return readSharedSourceClaim({
    fs: new InMemoryFileAdapter(),
    logger: new CapturingLogger(),
    frameworkMarketplaceName: "aidd-framework",
    platform: "linux",
    references,
  });
}

describe("reading this project's claim on the shared source", () => {
  it("names the shared marketplace, the root and the other projects that still reference it", async () => {
    const references = new RecordingSourceReferences(["/project", "/other"]);

    const claim = await reader(references)({
      projectRoot: "/project",
      list: async () => [SHARED],
    });

    expect(claim).toEqual({
      alias: "aidd-framework",
      resolvedRoot: "/project",
      otherProjects: ["/other"],
    });
  });

  it("finds no claim when no shared, machine-scope marketplace is registered", async () => {
    const claim = await reader(new RecordingSourceReferences(["/other"]))({
      projectRoot: "/project",
      list: async () => [{ name: "aidd-framework", scope: "project" }],
    });

    expect(claim).toBeUndefined();
  });

  it("finds no claim, and lists no marketplace, when no references file is wired", async () => {
    let listed = false;

    const claim = await reader(undefined)({
      projectRoot: "/project",
      list: async () => {
        listed = true;
        return [SHARED];
      },
    });

    expect(claim).toBeUndefined();
    expect(listed).toBe(false);
  });
});
