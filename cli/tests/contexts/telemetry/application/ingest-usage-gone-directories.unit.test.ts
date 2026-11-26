import { describe, expect, it } from "vitest";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { resolutionKey } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { cloneOf, grantedBy, tokenOf } from "../testing/clone.builder.js";
import { A, line, NOW, repository, setup, sha } from "../testing/ingest-usage-setup.builder.js";

const WIDGETS = sha("github.com/acme/widgets");

function sighting(dir: string, clone = A, seenAt = "2026-10-01T00:00:00.000Z") {
  return { dir, repository_id: WIDGETS, root: dir, clone, seen_at: seenAt };
}

describe("a directory that is gone is judged by the clone it was seen in", () => {
  function remember(s: ReturnType<typeof setup>, dir: string, clone = A): void {
    s.resolutions.resolutions.set(resolutionKey(dir, clone), sighting(dir, clone));
  }

  async function deletedWorktree(s: ReturnType<typeof setup>) {
    remember(s, "/work/wt");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1, { cwd: "/work/wt" })]);
    return s.ingest.execute();
  }

  it("remembers the clone of every directory it sees alive, once", async () => {
    const s = setup();
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    await s.ingest.execute();
    expect([...s.resolutions.resolutions.values()]).toEqual([
      sighting("/work/a", A, NOW.toISOString()),
    ]);
  });

  it("stores a deleted worktree because its clone consented and says yes now", async () => {
    expect(await deletedWorktree(setup())).toMatchObject({ added: 1 });
  });

  it("refuses a deleted worktree's call made after its clone said no, and keeps the one before", async () => {
    for (const now of ["off", null]) {
      const s = setup();
      s.consents.cloneSays(A, now);
      remember(s, "/work/wt");
      s.transcripts.files.set("/t/1.jsonl", [
        line("before", 1, { cwd: "/work/wt" }, "2026-10-08T23:59:59.999Z"),
        line("after", 2, { cwd: "/work/wt" }, NOW.toISOString()),
      ]);
      const result = await s.ingest.execute();
      expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_before:req_before"]);
      expect(result.notStored["no-consent"]).toBe(1);
    }
  });

  it("refuses a deleted worktree of a clone that names a token but never ran on", async () => {
    const s = setup();
    s.history.written.length = 0;
    const result = await deletedWorktree(s);
    expect(result).toMatchObject({ added: 0 });
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("counts a clone whose git config cannot be read as unreadable", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    expect((await deletedWorktree(s)).notStored["unreadable-consent"]).toBe(1);
  });

  it("does not close the consent of a clone whose git config cannot be read", async () => {
    const s = setup();
    s.consents.unreadableClones.add(cloneKey(A));
    await deletedWorktree(s);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open"]);
  });

  it("judges a clone that is gone by what it consented to, and no clone by a key it never held", async () => {
    const yes = setup();
    yes.consents.clones.clear();
    expect(await deletedWorktree(yes)).toMatchObject({ added: 1 });
    const no = setup();
    no.consents.clones.clear();
    no.history.written.length = 0;
    expect((await deletedWorktree(no)).notStored["no-consent"]).toBe(1);
  });

  it("closes the consent of a clone another directory has replaced, at the moment it finds it", async () => {
    const s = setup();
    s.consents.clones.clear();
    s.consents.replacedClones.add(cloneKey(A));
    await deletedWorktree(s);
    expect(s.history.written.at(-1)).toEqual({
      kind: "close",
      token: tokenOf(A),
      at: NOW.toISOString(),
    });
  });

  it("keeps open the consent of a clone with nothing at its path, which may only be out of reach", async () => {
    const s = setup();
    s.consents.clones.clear();
    const result = await deletedWorktree(s);
    expect(s.history.written.map((event) => event.kind)).toEqual(["open"]);
    expect(result).toMatchObject({ added: 1 });
    expect(result.notStored["no-consent"]).toBe(0);
  });

  it("stores a call a replaced clone made before it was found replaced, and refuses one dated after", async () => {
    const s = setup();
    s.consents.clones.clear();
    s.consents.replacedClones.add(cloneKey(A));
    remember(s, "/work/wt");
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { cwd: "/work/wt" }, "2026-10-08T23:59:59.999Z"),
      line("B", 2, { cwd: "/work/wt" }, "2026-10-09T00:00:00.000Z"),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_A:req_A"]);
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("looks at every clone whose consent is open, though no call of it was read", async () => {
    const s = setup();
    s.consents.cloneSays(A, "off");
    const result = await s.ingest.execute();
    expect(result.added).toBe(0);
    expect(s.history.written.at(-1)).toEqual({
      kind: "close",
      token: tokenOf(A),
      at: NOW.toISOString(),
    });
  });

  it("does not write the same close twice", async () => {
    const s = setup();
    s.consents.cloneSays(A, "off");
    await s.ingest.execute();
    await s.ingest.execute();
    expect(s.history.written.filter((event) => event.kind === "close")).toHaveLength(1);
  });

  it("does not take a clone made at the same path since for the clone that was there", async () => {
    const s = setup();
    s.history.written.length = 0;
    const successor = cloneOf(A.path, { ino: "99", birthtimeMs: 5_000 });
    s.consents.cloneSays(successor, grantedBy(successor));
    s.history.consented(successor);
    s.consents.clones.delete(cloneKey(A));
    const result = await deletedWorktree(s);
    expect(result).toMatchObject({ added: 0 });
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("asks a clone once however many deleted directories it covers", async () => {
    const s = setup();
    remember(s, "/work/wt2");
    remember(s, "/work/wt2/src");
    s.transcripts.files.set("/t/1.jsonl", [
      line("A", 1, { cwd: "/work/wt2" }),
      line("B", 2, { cwd: "/work/wt2/src" }),
    ]);
    await s.ingest.execute();
    expect(s.consents.cloneReads).toEqual([A.path]);
  });

  it("does not snapshot the declarations of a deleted worktree, though its clone says yes", async () => {
    const s = setup();
    s.bindings.bindingsByRoot.set("/work/wt", [
      {
        branch: "feat/x",
        task: "t",
        ticket: null,
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
    await deletedWorktree(s);
    expect(s.snapshotStore.appended).toEqual([]);
  });

  it("forgets what an earlier format held: a directory it names is seen again, or counted", async () => {
    const s = setup();
    s.locator.directories.delete("/work/a");
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    expect((await s.ingest.execute()).notStored["never-seen-alive"]).toBe(1);
  });
});

describe("a call is judged at its own time", () => {
  const EPOCH = "1970-01-01T00:00:00.000Z";
  const B = cloneOf("/work/a/.git", { ino: "99", birthtimeMs: 5_000 });

  it("gives a clone two owners of one directory, each its own calls", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.resolutions.resolutions.set(resolutionKey("/work/a", A), sighting("/work/a", A));
    s.locator.directories.set("/work/a", repository("/work/a", { clone: B }));
    s.consents.clones.delete(cloneKey(A));
    s.consents.cloneSays(B, grantedBy(B));
    s.history.consented(B, EPOCH);
    s.transcripts.files.set("/t/1.jsonl", [
      line("old", 1, {}, new Date(1_000).toISOString()),
      line("new", 2, {}, new Date(6_000).toISOString()),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_new:req_new"]);
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("stores what the earlier clone made while it consented, and snapshots nothing of the directory the later one holds", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.history.consented(A, EPOCH);
    s.resolutions.resolutions.set(resolutionKey("/work/a", A), sighting("/work/a", A));
    s.locator.directories.set("/work/a", repository("/work/a", { clone: B }));
    s.consents.clones.delete(cloneKey(A));
    s.consents.cloneSays(B, grantedBy(B));
    s.history.consented(B, EPOCH);
    s.bindings.bindingsByRoot.set("/work/a", [
      {
        branch: "feat/a",
        task: "t",
        ticket: null,
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
    s.transcripts.files.set("/t/1.jsonl", [line("old", 1, {}, new Date(1_000).toISOString())]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual(["msg_old:req_old"]);
    expect(result.snapshots).toBe(0);
  });

  it("stores a call made while the clone consented, and not one made while it did not", async () => {
    const s = setup();
    s.history.written.length = 0;
    s.history.written.push(
      { kind: "open", token: "first", clone: A, at: "2026-10-01T00:00:00.000Z" },
      { kind: "close", token: "first", at: "2026-10-05T00:00:00.000Z" },
      { kind: "open", token: tokenOf(A), clone: A, at: "2026-10-07T10:00:00.000Z" }
    );
    s.transcripts.files.set("/t/1.jsonl", [
      line("before", 1, {}, "2026-10-02T00:00:00.000Z"),
      line("off", 2, {}, "2026-10-06T00:00:00.000Z"),
      line("again", 3, {}, "2026-10-07T10:00:00.000Z"),
      line("last", 4, {}, "2026-10-08T00:00:00.000Z"),
    ]);
    const result = await s.ingest.execute();
    expect(s.ledger.records.map((r) => r.key)).toEqual([
      "msg_again:req_again",
      "msg_before:req_before",
      "msg_last:req_last",
    ]);
    expect(result.notStored["no-consent"]).toBe(1);
  });

  it("refuses a clone the platform cannot identify, and remembers nothing of it", async () => {
    const s = setup();
    s.locator.directories.set("/work/a", repository("/work/a", { clone: null }));
    s.transcripts.files.set("/t/1.jsonl", [line("A", 1)]);
    const result = await s.ingest.execute();
    expect(result.notStored["unreadable-consent"]).toBe(1);
    expect(s.resolutions.resolutions.size).toBe(0);
  });
});
