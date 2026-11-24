import { link, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ensureInstallationId } from "../../../src/runtime/filesystem/installation-identity.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, link: vi.fn(original.link) };
});

const roots: string[] = [];
afterEach(async () => {
  vi.mocked(link).mockReset();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aidd-installation-race-"));
  roots.push(root);
  return root;
}

it("keeps the identity installed by a concurrent initializer", async () => {
  const root = await makeRoot();
  const winner = "a720868e-d80a-4c71-96aa-2ce56936b35d";
  vi.mocked(link).mockImplementationOnce(async (_temporary, path) => {
    await writeFile(path, JSON.stringify({ installation_id: winner }), { mode: 0o600 });
    throw Object.assign(new Error("already exists"), { code: "EEXIST" });
  });

  expect(await ensureInstallationId(root)).toBe(winner);
  expect(await readdir(join(root, "installation"))).toEqual(["id.json"]);
});

it("cleans up the temporary identity if the filesystem rejects installation", async () => {
  const root = await makeRoot();
  vi.mocked(link).mockRejectedValueOnce(Object.assign(new Error("disk error"), { code: "EIO" }));

  await expect(ensureInstallationId(root)).rejects.toMatchObject({ code: "EIO" });
  expect(await readdir(join(root, "installation"))).toEqual([]);
});

it("reports when a concurrently installed identity disappears", async () => {
  const root = await makeRoot();
  vi.mocked(link).mockRejectedValueOnce(
    Object.assign(new Error("already exists"), { code: "EEXIST" })
  );

  await expect(ensureInstallationId(root)).rejects.toThrow("disappeared during setup");
  expect(await readdir(join(root, "installation"))).toEqual([]);
});
