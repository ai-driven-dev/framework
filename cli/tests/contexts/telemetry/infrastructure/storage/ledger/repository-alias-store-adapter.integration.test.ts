import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RepositoryAliasStoreAdapter } from "../../../../../../src/contexts/telemetry/infrastructure/storage/ledger/repository-alias-store-adapter.js";

let ledgerDir: string;
beforeEach(() => {
  ledgerDir = realpathSync(mkdtempSync(join(tmpdir(), "aidd-aliases-")));
});
afterEach(() => {
  rmSync(ledgerDir, { recursive: true, force: true });
});

describe("the repository ids an earlier version renamed", () => {
  it("are read from repository-ids.json beside the ledger", async () => {
    writeFileSync(
      join(ledgerDir, "repository-ids.json"),
      JSON.stringify({ version: 1, aliases: { old: "new" } })
    );
    expect(await new RepositoryAliasStoreAdapter(ledgerDir).load()).toEqual(
      new Map([["old", "new"]])
    );
  });

  it("are none when the file is missing", async () => {
    expect(await new RepositoryAliasStoreAdapter(ledgerDir).load()).toBeNull();
  });
});
