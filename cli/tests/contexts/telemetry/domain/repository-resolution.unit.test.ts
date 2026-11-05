import { describe, expect, it } from "vitest";
import type { CloneIdentity } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import {
  cwdKey,
  ownersAt,
  parseResolutions,
  type RepositoryResolution,
  renderResolutions,
  resolutionKey,
  sameResolution,
} from "../../../../src/contexts/telemetry/domain/repository-resolution.js";

const CLONE: CloneIdentity = { path: "/r/.git", dev: "1", ino: "7", birthtimeMs: 1_000 };
const resolution: RepositoryResolution = {
  dir: "/r",
  repository_id: "id-1",
  root: "/r",
  clone: CLONE,
  seen_at: "2026-10-01T00:00:00.000Z",
};
const keyed = (...all: RepositoryResolution[]) =>
  new Map(all.map((one) => [resolutionKey(one.dir, one.clone), one]));

describe("the key a working directory is remembered under", () => {
  it("is the directory as written on a case-sensitive file system", () => {
    expect(cwdKey("/Work/Repo", false)).toBe("/Work/Repo");
  });

  it("is case-folded on a case-insensitive one, so two spellings share one entry", () => {
    expect(cwdKey("/Work/Repo", true)).toBe("/work/repo");
    expect(cwdKey("C:\\Work\\Repo", true)).toBe(cwdKey("c:\\work\\repo", true));
  });

  it("is one per directory and clone", () => {
    expect(resolutionKey("/r", CLONE)).toBe(resolutionKey("/r", { ...CLONE }));
    expect(resolutionKey("/r", CLONE)).not.toBe(resolutionKey("/r", { ...CLONE, ino: "8" }));
    expect(resolutionKey("/r", CLONE)).not.toBe(resolutionKey("/s", CLONE));
  });
});

describe("whether a directory was found to be the same", () => {
  it("is when the repository and the root are", () => {
    expect(sameResolution(resolution, { ...resolution })).toBe(true);
    expect(sameResolution(resolution, { ...resolution, seen_at: "2027-01-01T00:00:00.000Z" })).toBe(
      true
    );
  });

  it.each([
    ["nothing was remembered", undefined],
    ["the repository differs", { ...resolution, repository_id: "other" }],
    ["the root differs", { ...resolution, root: "/elsewhere" }],
  ])("is not when %s", (_name, held) => {
    expect(sameResolution(held, resolution)).toBe(false);
  });
});

describe("the remembered resolutions", () => {
  it("round-trip", () => {
    const map = keyed(resolution);
    expect(parseResolutions(renderResolutions(map))).toEqual(map);
  });

  it("render in key order, so the file does not depend on discovery order", () => {
    const text = renderResolutions(
      keyed({ ...resolution, dir: "/b" }, { ...resolution, dir: "/a" })
    );
    expect(JSON.parse(text).directories.map((d: RepositoryResolution) => d.dir)).toEqual([
      "/a",
      "/b",
    ]);
    expect(JSON.parse(text).version).toBe(2);
  });

  it("start empty from no file or an unreadable one", () => {
    expect(parseResolutions(null).size).toBe(0);
    expect(parseResolutions("{bad").size).toBe(0);
    expect(parseResolutions("[]").size).toBe(0);
    expect(parseResolutions("null").size).toBe(0);
  });

  it("start empty from a file of another format, the one before clones had an identity included", () => {
    expect(
      parseResolutions(
        JSON.stringify({
          "/r": { repository_id: "x", root: "/r", consented: true, clone: "/r/.git" },
        })
      ).size
    ).toBe(0);
    expect(parseResolutions(JSON.stringify({ version: 1, directories: [resolution] })).size).toBe(
      0
    );
    expect(parseResolutions(JSON.stringify({ version: 2, directories: "x" })).size).toBe(0);
  });

  it("drop an entry that is not a resolution and keep the rest", () => {
    const text = JSON.stringify({
      version: 2,
      directories: [
        resolution,
        "x",
        { ...resolution, dir: "" },
        { ...resolution, dir: 4 },
        { ...resolution, repository_id: "" },
        { ...resolution, repository_id: 4 },
        { ...resolution, root: 4 },
        { ...resolution, seen_at: "later" },
        { ...resolution, seen_at: 4 },
        { ...resolution, clone: "/r/.git" },
        { ...resolution, clone: { ...CLONE, ino: "0" } },
      ],
    });
    expect([...parseResolutions(text).values()]).toEqual([resolution]);
  });
});

describe("the clone that answers for a call", () => {
  const old = { ...resolution, clone: { ...CLONE, ino: "1", birthtimeMs: 1_000 } };
  const next = { ...resolution, clone: { ...CLONE, ino: "2", birthtimeMs: 5_000 } };

  it("is the only clone there is, whenever the call was made", () => {
    expect(ownersAt([old], 0)).toEqual([old]);
    expect(ownersAt([old], 1e12)).toEqual([old]);
  });

  it("is the latest clone born by then", () => {
    expect(ownersAt([next, old], 4_999)).toEqual([old]);
    expect(ownersAt([next, old], 5_000)).toEqual([next]);
    expect(ownersAt([old, next], 9_000)).toEqual([next]);
  });

  it("is the first when the call is older than every clone", () => {
    expect(ownersAt([next, old], 10)).toEqual([old]);
  });

  it("goes by the time ingest first saw the directory, where a clone has no birth time", () => {
    const early = {
      ...old,
      clone: { ...old.clone, birthtimeMs: 0 },
      seen_at: "2026-10-01T00:00:00.000Z",
    };
    const late = {
      ...next,
      clone: { ...next.clone, birthtimeMs: 0 },
      seen_at: "2026-10-05T00:00:00.000Z",
    };
    expect(ownersAt([late, early], Date.parse("2026-10-04T00:00:00.000Z"))).toEqual([early]);
    expect(ownersAt([early, late], Date.parse("2026-10-05T00:00:00.000Z"))).toEqual([late]);
  });

  it("leaves tied birth times unresolved", () => {
    const tie = { ...old, clone: { ...old.clone, ino: "3" } };
    expect(ownersAt([old, tie], 1_000)).toEqual([old, tie]);
    expect(ownersAt([tie, old], 1_000)).toEqual([tie, old]);
  });
});
