import { describe, expect, it } from "vitest";
import {
  cwdKey,
  parseResolutions,
  type RepositoryResolution,
  renderResolutions,
} from "../../../../src/contexts/telemetry/domain/repository-resolution.js";

const resolution: RepositoryResolution = { repository_id: "id-1", root: "/r", consented: true };

describe("the key a working directory is remembered under", () => {
  it("is the directory as written on a case-sensitive file system", () => {
    expect(cwdKey("/Work/Repo", false)).toBe("/Work/Repo");
  });

  it("is case-folded on a case-insensitive one, so two spellings share one entry", () => {
    expect(cwdKey("/Work/Repo", true)).toBe("/work/repo");
    expect(cwdKey("C:\\Work\\Repo", true)).toBe(cwdKey("c:\\work\\repo", true));
  });
});

describe("the remembered resolutions", () => {
  it("round-trip", () => {
    const map = new Map([["/a", resolution]]);
    expect(parseResolutions(renderResolutions(map))).toEqual(map);
  });

  it("render in key order, so the file does not depend on discovery order", () => {
    const text = renderResolutions(
      new Map([
        ["/b", resolution],
        ["/a", resolution],
      ])
    );
    expect(Object.keys(JSON.parse(text))).toEqual(["/a", "/b"]);
  });

  it("start empty from no file or an unreadable one", () => {
    expect(parseResolutions(null).size).toBe(0);
    expect(parseResolutions("{bad").size).toBe(0);
    expect(parseResolutions("[]").size).toBe(0);
    expect(parseResolutions("null").size).toBe(0);
  });

  it("drop an entry that is not a resolution and keep the rest", () => {
    const text = JSON.stringify({
      "/ok": resolution,
      "/no-id": { root: "/r", consented: true },
      "/no-flag": { repository_id: "x", root: "/r" },
      "/string": "x",
      "/empty-id": { repository_id: "", root: "/r", consented: true },
      "/no-root": { repository_id: "x", consented: true },
      "/numeric-root": { repository_id: "x", root: 4, consented: true },
      "/numeric-id": { repository_id: 4, root: "/r", consented: true },
    });
    expect([...parseResolutions(text).keys()]).toEqual(["/ok"]);
  });
});
