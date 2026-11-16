import { describe, expect, it } from "vitest";
import { SharedFrameworkSource } from "../../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.js";
import type { UserSourceReferences } from "../../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { VersionReader } from "../../../../src/shared/ports/version-reader.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { FakeCurrentVersion } from "../../../helpers/ports/fake-current-version.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { TOOL } from "../../tools/testing/catalog-of.js";
import { RecordingSourceReferences } from "./recording-source-references.js";

const SHARED = { name: "aidd-framework", scope: "user" } as const;
const REGISTERED_AS_SHARED = new Map([
  [TOOL.codex, { buildFailed: false, marketplaces: [{ alias: "aidd-framework" }] }],
]);

function source(references?: UserSourceReferences, version?: VersionReader) {
  return new SharedFrameworkSource(
    new InMemoryFileAdapter(),
    new CapturingLogger(),
    references,
    version,
    { resolveCandidate: async () => null }
  );
}

describe("recording this project's claim on the shared source", () => {
  it("records nothing, and does not fail, when no references file is wired", async () => {
    await expect(
      source(undefined, new FakeCurrentVersion("1.0.0")).recordSharedSourceReference(
        "/project",
        [SHARED],
        REGISTERED_AS_SHARED
      )
    ).resolves.toBeUndefined();
  });

  it("records nothing, and does not fail, when no current version is wired", async () => {
    const references = new RecordingSourceReferences();

    await source(references, undefined).recordSharedSourceReference(
      "/project",
      [SHARED],
      REGISTERED_AS_SHARED
    );

    expect(references.added).toEqual([]);
  });

  it("records nothing when the shared source is not among the listed marketplaces", async () => {
    const references = new RecordingSourceReferences();

    await source(references, new FakeCurrentVersion("1.0.0")).recordSharedSourceReference(
      "/project",
      [{ name: "aidd-framework", scope: "project" }],
      REGISTERED_AS_SHARED
    );

    expect(references.added).toEqual([]);
  });

  it("records nothing when no host registered the shared source under its own name", async () => {
    const references = new RecordingSourceReferences();

    await source(references, new FakeCurrentVersion("1.0.0")).recordSharedSourceReference(
      "/project",
      [SHARED],
      new Map([[TOOL.codex, { buildFailed: false, marketplaces: [{ alias: "another" }] }]])
    );

    expect(references.added).toEqual([]);
  });
});
