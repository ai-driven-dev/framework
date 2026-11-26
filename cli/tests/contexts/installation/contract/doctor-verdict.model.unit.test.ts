import { describe, expect, it } from "vitest";
import {
  areScopesHealthy,
  isDoctorHealthy,
  isReportHealthy,
} from "../../../../src/contexts/installation/contract/doctor-verdict.model.js";

describe("the verdict of one doctor run", () => {
  it("is healthy when nothing was found", () => {
    expect(isReportHealthy([], [])).toBe(true);
  });

  it("is healthy when only information was found", () => {
    expect(isReportHealthy([{ severity: "info" }], [])).toBe(true);
  });

  it.each(["warning", "error"] as const)("is not healthy on a %s", (severity) => {
    expect(isReportHealthy([{ severity }], [])).toBe(false);
  });

  it("is not healthy when a plugin has an issue", () => {
    expect(isReportHealthy([], [{}])).toBe(false);
  });
});

describe("the verdict over both scopes", () => {
  it("is healthy when both scopes are", () => {
    expect(areScopesHealthy({ healthy: true }, { healthy: true })).toBe(true);
  });

  it.each([
    [{ healthy: false }, { healthy: true }],
    [{ healthy: true }, { healthy: false }],
  ])("is not healthy when one scope is not", (ai, ide) => {
    expect(areScopesHealthy(ai, ide)).toBe(false);
  });

  it.each([
    [null, { healthy: true }],
    [{ healthy: true }, null],
  ])("is not healthy when a scope could not be checked", (ai, ide) => {
    expect(areScopesHealthy(ai, ide)).toBe(false);
  });
});

describe("the exit verdict of a report", () => {
  it("follows the report when no plugin is named", () => {
    expect(isDoctorHealthy({ pluginIssues: [], healthy: false }, undefined)).toBe(false);
  });

  it("follows the named plugin's issues alone, whatever the report says", () => {
    expect(isDoctorHealthy({ pluginIssues: [], healthy: false }, "p")).toBe(true);
    expect(isDoctorHealthy({ pluginIssues: [{}], healthy: true }, "p")).toBe(false);
  });
});
