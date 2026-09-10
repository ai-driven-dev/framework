import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersonIdentityAdapter } from "../../../../src/contexts/telemetry/infrastructure/person-identity-adapter.js";
import { IdentityWriteError, UnreadableIdentityFileError } from "../../../../src/kernel/errors.js";

/** On real disk: every write here goes through the file and is read back through it, since
 * what this adapter stores is what decides whose records are whose. */
describe("PersonIdentityAdapter.forget — resolved once, acts on the path it is handed", () => {
  let previousHome: string | undefined;
  const homes: string[] = [];

  beforeEach(() => {
    previousHome = process.env.HOME;
  });

  afterEach(async () => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true });
  });

  async function freshHome(): Promise<string> {
    const home = await mkdtemp(join(tmpdir(), "aidd-identity-adapter-"));
    homes.push(home);
    return home;
  }

  it("removes the identity file it was constructed against", async () => {
    const home = await freshHome();
    process.env.HOME = home;
    const adapter = new PersonIdentityAdapter();
    await adapter.mint();

    const wasThere = await adapter.forget(adapter.filePath);

    expect(wasThere).toBe(true);
    await expect(readFile(adapter.filePath, "utf8")).rejects.toThrow();
  });

  it("is a no-op, not a failure, when the path is already gone", async () => {
    const home = await freshHome();
    process.env.HOME = home;
    const adapter = new PersonIdentityAdapter();

    await expect(adapter.forget(adapter.filePath)).resolves.toBe(false);
  });

  // `filePath` is frozen at construction and `forget` never asks `HOME` again, so a
  // relocation between the preview and the removal cannot redirect it.
  it("acts on the path it is handed, immune to HOME being relocated afterwards", async () => {
    const realHome = await freshHome();
    process.env.HOME = realHome;
    const adapter = new PersonIdentityAdapter();
    await adapter.mint();
    const shownPath = adapter.filePath; // what a preview would have shown

    const elsewhereHome = await freshHome();
    await mkdir(join(elsewhereHome, ".config", "aidd"), { recursive: true });
    const victimPath = join(elsewhereHome, ".config", "aidd", "identity.json");
    await writeFile(victimPath, '{"person_id":"victim"}\n');

    process.env.HOME = elsewhereHome; // relocated AFTER the path was shown

    await adapter.forget(shownPath);

    await expect(readFile(shownPath, "utf8")).rejects.toThrow();
    expect(await readFile(victimPath, "utf8")).toContain("victim");
  });
});

describe("PersonIdentityAdapter — what it writes, and what it reads back", () => {
  let previousHome: string | undefined;
  const homes: string[] = [];

  beforeEach(() => {
    previousHome = process.env.HOME;
  });

  afterEach(async () => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true });
  });

  /** A throwaway profile, with the adapter constructed against it — `filePath` is frozen at
   * construction, so the home has to be in place first. */
  async function adapterInFreshHome(): Promise<PersonIdentityAdapter> {
    const home = await mkdtemp(join(tmpdir(), "aidd-identity-rw-"));
    homes.push(home);
    process.env.HOME = home;
    await mkdir(join(home, ".config", "aidd"), { recursive: true });
    return new PersonIdentityAdapter();
  }

  it("reads back nothing at all before anyone has chosen", async () => {
    const adapter = await adapterInFreshHome();

    expect(await adapter.read()).toBeNull();
    expect(await adapter.readStrict()).toBeNull();
  });

  it("mints an identifier that survives a read back through the file", async () => {
    const adapter = await adapterInFreshHome();

    const minted = await adapter.mint();

    expect(minted.origin).toBe("minted");
    expect(minted.personId).not.toBe("");
    expect(await adapter.readStrict()).toEqual(minted);
  });

  // The distinction `origin` exists for: an identifier this machine created is not the same
  // fact as one carried here from another machine.
  it("records an adopted identifier as adopted, not as minted", async () => {
    const adapter = await adapterInFreshHome();
    await adapter.mint();

    const adopted = await adapter.adopt("person-from-another-machine");

    expect(adopted).toMatchObject({ personId: "person-from-another-machine", origin: "adopted" });
    expect(await adapter.readStrict()).toEqual(adopted);
  });

  it("keeps a display name across a later write", async () => {
    const adapter = await adapterInFreshHome();
    const minted = await adapter.mint();

    await adapter.setDisplayName(minted, "Ada");
    const linked = await adapter.addAlsoMe("machine-2");

    expect(linked.displayName).toBe("Ada");
    expect(await adapter.readStrict()).toEqual(linked);
  });

  it("adds and withdraws an added identifier, leaving the person's own untouched", async () => {
    const adapter = await adapterInFreshHome();
    const minted = await adapter.mint();

    await adapter.addAlsoMe("machine-2");
    await adapter.addAlsoMe("machine-3");
    const after = await adapter.removeAlsoMe("machine-2");

    expect(after.personId).toBe(minted.personId);
    expect(after.alsoMe).toEqual(["machine-3"]);
    expect(await adapter.readStrict()).toEqual(after);
  });

  // `withAlsoMeAdded`'s rule, held on the real file: a person's own identifier is not an
  // identifier added onto them.
  it("refuses to list the person's own identifier among the ones added onto them", async () => {
    const adapter = await adapterInFreshHome();
    const minted = await adapter.mint();

    const after = await adapter.addAlsoMe(minted.personId);

    expect(after.alsoMe).toEqual([]);
  });

  // `read` is for every consumer that must not fail over one damaged file; `readStrict` for
  // the one caller that has to tell "nobody chose" apart from "could not be read".
  it("reads a damaged file as nothing, and refuses it strictly", async () => {
    const adapter = await adapterInFreshHome();
    await writeFile(adapter.filePath, "{ not json");

    expect(await adapter.read()).toBeNull();
    await expect(adapter.readStrict()).rejects.toThrow(/identity/iu);
  });

  it("refuses to add an identifier when nobody has chosen one to add it onto", async () => {
    const adapter = await adapterInFreshHome();

    await expect(adapter.addAlsoMe("machine-2")).rejects.toThrow();
  });

  it("writes a file a person can open and correct by hand", async () => {
    const adapter = await adapterInFreshHome();
    const minted = await adapter.mint();

    const raw = await readFile(adapter.filePath, "utf8");

    expect(JSON.parse(raw)).toMatchObject({ person_id: minted.personId, origin: "minted" });
    expect(raw.endsWith("\n")).toBe(true);
  });

  it("writes the quietest shape: no also_me key until an identifier is added", async () => {
    const adapter = await adapterInFreshHome();
    const minted = await adapter.mint();

    expect(JSON.parse(await readFile(adapter.filePath, "utf8"))).toStrictEqual({
      person_id: minted.personId,
      origin: "minted",
    });
  });

  it.skipIf(process.platform === "win32")(
    "writes a file readable by this person alone",
    async () => {
      const adapter = await adapterInFreshHome();

      await adapter.mint();

      expect(((await stat(adapter.filePath)).mode & 0o777).toString(8)).toBe("600");
    }
  );

  it("reads an empty person_id as nobody having chosen", async () => {
    const adapter = await adapterInFreshHome();
    await writeFile(adapter.filePath, '{"person_id":""}\n');

    expect(await adapter.read()).toBeNull();
    expect(await adapter.readStrict()).toBeNull();
  });

  it("reads a person_id that is not a string as nobody having chosen", async () => {
    const adapter = await adapterInFreshHome();
    await writeFile(adapter.filePath, '{"person_id":42}\n');

    expect(await adapter.readStrict()).toBeNull();
  });

  it("keeps only the strings among the identifiers added onto a person", async () => {
    const adapter = await adapterInFreshHome();
    await writeFile(adapter.filePath, '{"person_id":"p-1","also_me":["machine-2",3,null]}\n');

    expect(await adapter.readStrict()).toStrictEqual({
      personId: "p-1",
      origin: "minted",
      alsoMe: ["machine-2"],
    });
  });

  it("reads an empty display name as none at all", async () => {
    const adapter = await adapterInFreshHome();
    await writeFile(adapter.filePath, '{"person_id":"p-1","display_name":""}\n');

    expect(await adapter.readStrict()).toStrictEqual({
      personId: "p-1",
      origin: "minted",
      alsoMe: [],
    });
  });

  it("reads a display name that is not a string as none at all", async () => {
    const adapter = await adapterInFreshHome();
    await writeFile(adapter.filePath, '{"person_id":"p-1","display_name":7}\n');

    expect(await adapter.readStrict()).toStrictEqual({
      personId: "p-1",
      origin: "minted",
      alsoMe: [],
    });
  });

  it("says what it was asked to add onto when no identity exists", async () => {
    const adapter = await adapterInFreshHome();

    await expect(adapter.addAlsoMe("machine-2")).rejects.toThrow(
      `Could not write the identity file at ${adapter.filePath} (no identity exists to add an identifier onto).`
    );
  });

  it("says what it was asked to remove from when no identity exists", async () => {
    const adapter = await adapterInFreshHome();

    await expect(adapter.removeAlsoMe("machine-2")).rejects.toThrow(
      `Could not write the identity file at ${adapter.filePath} (no identity exists to remove an identifier onto).`
    );
  });

  it("refuses strictly a file that is there but cannot be read as a file", async () => {
    const adapter = await adapterInFreshHome();
    await mkdir(adapter.filePath);

    const strict = adapter.readStrict();

    await expect(strict).rejects.toBeInstanceOf(UnreadableIdentityFileError);
    await expect(strict).rejects.toThrow(
      `Could not read the identity file at ${adapter.filePath} (EISDIR`
    );
  });

  it("reports a write that could not go out, naming the file", async () => {
    const home = await mkdtemp(join(tmpdir(), "aidd-identity-rw-"));
    homes.push(home);
    process.env.HOME = home;
    await writeFile(join(home, ".config"), "");
    const adapter = new PersonIdentityAdapter();

    const minted = adapter.mint();

    await expect(minted).rejects.toBeInstanceOf(IdentityWriteError);
    await expect(minted).rejects.toThrow(
      `Could not write the identity file at ${adapter.filePath} (ENOTDIR`
    );
  });
});

describe("PersonIdentityAdapter.forget — what it removes and what it reports", () => {
  let previousHome: string | undefined;
  const homes: string[] = [];

  beforeEach(() => {
    previousHome = process.env.HOME;
  });

  afterEach(async () => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true });
  });

  async function adapterInFreshHome(): Promise<PersonIdentityAdapter> {
    const home = await mkdtemp(join(tmpdir(), "aidd-identity-forget-"));
    homes.push(home);
    process.env.HOME = home;
    await mkdir(join(home, ".config", "aidd"), { recursive: true });
    return new PersonIdentityAdapter();
  }

  it("removes a damaged identity that is a directory, not a file", async () => {
    const adapter = await adapterInFreshHome();
    await mkdir(adapter.filePath);
    await writeFile(join(adapter.filePath, "stray"), "");

    expect(await adapter.forget(adapter.filePath)).toBe(true);
    await expect(readFile(adapter.filePath, "utf8")).rejects.toThrow();
  });

  it("reports a removal that failed for a reason other than being gone, as a removal", async () => {
    const adapter = await adapterInFreshHome();
    await adapter.mint();
    const unreachable = join(adapter.filePath, "child");

    const forgotten = adapter.forget(unreachable);

    await expect(forgotten).rejects.toBeInstanceOf(IdentityWriteError);
    await expect(forgotten).rejects.toThrow(
      `Could not remove the identity file at ${unreachable} (ENOTDIR`
    );
  });
});
