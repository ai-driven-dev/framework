import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { HEAD_CATALOG, STABLE_CATALOG } from "../testing/raw-catalog.contract.js";

const schemaPath = new URL(
  "../../../../assets/schemas/claude-marketplace-manifest.json",
  import.meta.url
);
const accepts = new Ajv().compile(JSON.parse(readFileSync(fileURLToPath(schemaPath), "utf8")));

describe("the catalogs the raw catalog contract serves", () => {
  it.each([
    ["the default ref", HEAD_CATALOG],
    ["the stable ref", STABLE_CATALOG],
  ])("is a catalog the published Claude marketplace schema accepts, on %s", (_ref, catalog) => {
    expect(accepts(JSON.parse(catalog))).toBe(true);
  });

  it("is told apart by that schema from a catalog without plugins", () => {
    expect(accepts({ name: "head" })).toBe(false);
  });
});
