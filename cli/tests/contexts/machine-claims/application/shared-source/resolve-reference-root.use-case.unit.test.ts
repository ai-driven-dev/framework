import { describe, expect, it } from "vitest";
import { ResolveReferenceRoot } from "../../../../../src/contexts/machine-claims/application/shared-source/resolve-reference-root.use-case.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";

describe("resolving the root of a reference", () => {
  it("propagates a resolution failure other than the project being absent", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", "/project", errnoError("EACCES"));

    await expect(new ResolveReferenceRoot(fs).execute("/project")).rejects.toThrow(
      "EACCES: planted by the test"
    );
  });
});
