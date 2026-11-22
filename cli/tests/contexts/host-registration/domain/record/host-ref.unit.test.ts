import { describe, expect, it } from "vitest";
import {
  isRefOnHost,
  refOnAnyHost,
  refOnHostName,
} from "../../../../../src/contexts/host-registration/domain/record/host-ref.js";

describe("checking a ref is on a host", () => {
  it("holds for a ref that ends with the host name after the separator", () => {
    expect(isRefOnHost("a@catalog", "catalog")).toBe(true);
    expect(isRefOnHost("a@catalog", "second")).toBe(false);
  });

  it("matches the host name exactly, not a longer name around it", () => {
    expect(isRefOnHost("a@old-catalog", "catalog")).toBe(false);
    expect(isRefOnHost("a@catalog-two", "catalog")).toBe(false);
    expect(isRefOnHost("catalog", "catalog")).toBe(false);
  });
});

describe("checking a ref is on any host", () => {
  it("holds for a ref on one of the host names, and for none else", () => {
    expect(refOnAnyHost("a@catalog", ["second", "catalog"])).toBe(true);
    expect(refOnAnyHost("a@catalog", ["second"])).toBe(false);
    expect(refOnAnyHost("a@catalog", [])).toBe(false);
  });
});

describe("naming a ref on a host", () => {
  it("names a plugin's ref on a host catalogue by the host name", () => {
    expect(refOnHostName("p", "catalog")).toBe("p@catalog");
  });
});
