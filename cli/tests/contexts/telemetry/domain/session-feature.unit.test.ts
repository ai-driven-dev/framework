import { describe, expect, it } from "vitest";
import type { AttributionFacts } from "../../../../src/contexts/telemetry/domain/report/attribution.js";
import {
  coversConsentWindow,
  sessionFeatureOf,
} from "../../../../src/contexts/telemetry/domain/report/session-feature.js";
import type { StoredUsage } from "../../../../src/contexts/telemetry/domain/stored-usage.js";

const facts: AttributionFacts = { declarations: [], carries: [], branches: new Map() };
const call: StoredUsage = {
  tool: "codex",
  tool_version: null,
  key: "request",
  session_id: "session",
  agent: "main",
  at: "2026-11-04T00:00:00Z",
  model: null,
  input: 1,
  output: 1,
  cache_read: null,
  cache_write: null,
  cache_write_1h: null,
  reasoning: null,
  cwd: null,
  git_branch: "feature/work",
  repository_id: "repo",
};

describe("session feature binding", () => {
  it("leaves initially unbound sessions unbound", () => {
    expect(sessionFeatureOf([call], facts)).toEqual({ state: "unbound" });
  });
  it("confirms only the same declared ticket and branch for every call", () => {
    const declared: AttributionFacts = {
      ...facts,
      declarations: [
        {
          session_id: "session",
          task: "work",
          ticket: "owner/repo#7",
          none: false,
          declared_at: "2026-11-03T00:00:00Z",
          by: "command",
        },
      ],
    };
    expect(sessionFeatureOf([call], declared)).toEqual({
      state: "confirmed",
      feature: "owner/repo#7",
      branch: "feature/work",
    });
    expect(sessionFeatureOf([call, { ...call, git_branch: "feature/other" }], declared)).toEqual({
      state: "ambiguous",
    });
    expect(sessionFeatureOf([call, { ...call, git_branch: null }], declared)).toEqual({
      state: "ambiguous",
    });
  });
});

it("never exports a cumulative metric across an off/on consent gap", () => {
  const clone = { path: "/repo/.git", dev: "1", ino: "2", birthtimeMs: 0 };
  const intervals = [
    { token: "one", clone, from: 100, to: 200 },
    { token: "two", clone, from: 300, to: null },
  ];
  expect(coversConsentWindow(intervals, clone, 120, 190)).toBe(true);
  expect(coversConsentWindow(intervals, clone, 120, 350)).toBe(false);
  expect(coversConsentWindow(intervals, clone, 300, 350)).toBe(true);
  expect(coversConsentWindow(intervals, clone, 190, 200)).toBe(false);
});
