import { describe, expect, it } from "vitest";
import {
  RememberedResolutions,
  type Sighting,
} from "../../../../src/contexts/telemetry/domain/remembered-resolutions.js";
import { resolutionKey } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { cloneOf } from "../testing/clone.builder.js";

const A = cloneOf("/a/.git");
const B = cloneOf("/a/.git", { ino: "9" });
const T1 = "2026-10-01T00:00:00.000Z";
const T2 = "2026-10-02T00:00:00.000Z";

const sighting = (extra: Partial<Sighting> = {}): Sighting => ({
  dir: "/a",
  repositoryId: "r1",
  root: "/a",
  clone: A,
  at: T1,
  ...extra,
});

const empty = () => new RememberedResolutions(new Map());

describe("the sightings of a directory in a clone", () => {
  it("keeps what it saw and says it learned something", () => {
    const { seen, remembered } = empty().remember(sighting());
    expect(seen).toEqual({ dir: "/a", repository_id: "r1", root: "/a", clone: A, seen_at: T1 });
    expect(remembered.changed).toBe(true);
    expect(remembered.sightings.get(resolutionKey("/a", A))).toEqual(seen);
  });

  it("keeps the first time it saw the directory and learns nothing from the same sighting later", () => {
    const first = empty().remember(sighting()).remembered;
    const again = first.remember(sighting({ at: T2 }));
    expect(again.seen.seen_at).toBe(T1);
    expect(again.remembered).toBe(first);
  });

  it("learns what the directory was found to be since, and keeps when it was first seen", () => {
    const first = empty().remember(sighting()).remembered;
    const moved = first.remember(sighting({ repositoryId: "r2", at: T2 }));
    expect(moved.seen).toMatchObject({ repository_id: "r2", seen_at: T1 });
    expect(moved.remembered.changed).toBe(true);
  });

  it("leaves the sightings it was added to as they were", () => {
    const first = empty();
    first.remember(sighting());
    expect(first.sightings.size).toBe(0);
    expect(first.changed).toBe(false);
  });

  it("names the clones that answered for a directory, and no other directory's", () => {
    const held = empty()
      .remember(sighting())
      .remembered.remember(sighting({ clone: B, at: T2 }))
      .remembered.remember(sighting({ dir: "/b", root: "/b" })).remembered;
    expect(held.ownersOf("/a").map((owner) => owner.clone)).toEqual([A, B]);
    expect(held.ownersOf("/b")).toHaveLength(1);
    expect(held.ownersOf("/c")).toEqual([]);
  });
});
