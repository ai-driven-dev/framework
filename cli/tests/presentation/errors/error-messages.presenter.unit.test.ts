import { describe, expect, it } from "vitest";
import { CATALOG } from "../../../src/presentation/errors/catalog-error-messages.presenter.js";
import { CORE } from "../../../src/presentation/errors/core-error-messages.presenter.js";
import { MESSAGES } from "../../../src/presentation/errors/error-messages.presenter.js";
import { INSTALLATION } from "../../../src/presentation/errors/installation-error-messages.presenter.js";

describe("the catalogue of error messages", () => {
  it("holds every table once, with no code in two of them", () => {
    const tables = [CORE, INSTALLATION, CATALOG];
    const codes = tables.flatMap((table) => Object.keys(table));
    expect(new Set(codes).size).toBe(codes.length);
    expect(Object.keys(MESSAGES).sort()).toEqual(codes.sort());
  });
});
