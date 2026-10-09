import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DAY_FILE,
  legacyLocations,
} from "../../../../../src/contexts/telemetry/domain/legacy/legacy-locations.js";

describe("where the previous version wrote", () => {
  it("names the home default, whatever XDG_CONFIG_HOME says, and the telemetry directory", () => {
    const found = legacyLocations({ XDG_CONFIG_HOME: "/xdg" }, "/h", "linux", "/h/t");
    expect(found.sinkDirs).toEqual(["/h/t", join("/h", ".config", "aidd", "telemetry")]);
    expect(found.identityFiles).toEqual([join("/h", ".config", "aidd", "identity.json")]);
  });

  it("adds the directories the environment named", () => {
    const found = legacyLocations(
      { AIDD_TELEMETRY_DIR: "/named", AIDD_USER_CONFIG_DIR: "/user" },
      "/h",
      "linux",
      "/user/telemetry"
    );
    expect(found.sinkDirs).toEqual([
      "/user/telemetry",
      "/named",
      join("/h", ".config", "aidd", "telemetry"),
    ]);
  });

  it("adds APPDATA on Windows only", () => {
    const env = { APPDATA: "/app" };
    expect(legacyLocations(env, "/h", "win32", "/t").sinkDirs).toContain(
      join("/app", "aidd", "telemetry")
    );
    expect(legacyLocations(env, "/h", "win32", "/t").identityFiles).toContain(
      join("/app", "aidd", "identity.json")
    );
    expect(legacyLocations(env, "/h", "linux", "/t").sinkDirs).not.toContain(
      join("/app", "aidd", "telemetry")
    );
  });

  it("treats an empty variable as unset, and lists a place once", () => {
    const found = legacyLocations(
      { AIDD_TELEMETRY_DIR: "", AIDD_USER_CONFIG_DIR: "" },
      "/h",
      "linux",
      join("/h", ".config", "aidd", "telemetry")
    );
    expect(found.sinkDirs).toEqual([join("/h", ".config", "aidd", "telemetry")]);
  });
});

describe("a day file's name", () => {
  it("is a date, not a ledger month", () => {
    expect(DAY_FILE.test("2026-10-07.jsonl")).toBe(true);
    expect(DAY_FILE.test("2026-10.jsonl")).toBe(false);
    expect(DAY_FILE.test("offsets.json")).toBe(false);
  });
});

describe("the edges of those places", () => {
  it("names the user configuration's telemetry directory apart from the one in use", () => {
    const found = legacyLocations({ AIDD_USER_CONFIG_DIR: "/user" }, "/h", "linux", "/t");
    expect(found.sinkDirs).toEqual([
      "/t",
      join("/user", "telemetry"),
      join("/h", ".config", "aidd", "telemetry"),
    ]);
  });

  it("takes a day file by its whole name only", () => {
    expect(DAY_FILE.test("x2026-10-07.jsonl")).toBe(false);
    expect(DAY_FILE.test("2026-10-07.jsonl.bak")).toBe(false);
    expect(DAY_FILE.test("2026-10-07.jsonlx")).toBe(false);
  });
});
