import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { RecordMachineClaims } from "../../../../../src/contexts/installation/application/sync/record-machine-claims.js";
import { registeredCatalog } from "../../../../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";

describe("RecordMachineClaims", () => {
  it("changes nothing without a machine manifest to write to", async () => {
    const record = new RecordMachineClaims(
      { fs: new InMemoryFileAdapter({}), records: registrationRecordRules },
      registeredCatalog()
    );

    await expect(
      record.execute({
        kind: "machine-claims",
        project: aManifest().build(),
        outcomes: new Map(),
        marketplaces: [],
        scope: "user",
      })
    ).resolves.toBe(false);
  });
});
