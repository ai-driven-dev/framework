import { describe, expect, it } from "vitest";
import { SchemaChecker } from "../../../../../src/contexts/translate/application/sinks/schema-checker.js";

describe("the schema checker", () => {
  it("validates the data against the schema the provider holds under that name", () => {
    const seen: unknown[] = [];
    const checker = new SchemaChecker(
      { validate: (schema, data) => seen.push([schema, data]) },
      { loadSchema: (name) => ({ name }) }
    );
    checker.validate("marketplace", { a: 1 });
    expect(seen).toEqual([[{ name: "marketplace" }, { a: 1 }]]);
  });
});
