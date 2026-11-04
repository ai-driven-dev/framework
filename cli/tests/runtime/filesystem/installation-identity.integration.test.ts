import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkInstallationId,
  ensureInstallationId,
  finishInstallationId,
} from "../../../src/runtime/filesystem/installation-identity.js";

const roots: string[] = [];
async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aidd-installation-id-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("installation identity", () => {
  it("creates one private UUID across repeated and concurrent initializations", async () => {
    const root = await makeRoot();
    const ids = await Promise.all(Array.from({ length: 12 }, () => ensureInstallationId(root)));
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(await ensureInstallationId(root)).toBe(ids[0]);
    const path = join(root, "installation", "id.json");
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ installation_id: ids[0] });
    expect(await readdir(join(root, "installation"))).toEqual(["id.json"]);
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("preserves a previously stored UUID and any additional fields", async () => {
    const root = await makeRoot();
    const directory = join(root, "installation");
    const existing = '{"installation_id":"a720868e-d80a-4c71-96aa-2ce56936b35d","future":"keep"}\n';
    await mkdir(directory);
    await writeFile(join(directory, "id.json"), existing, { mode: 0o600 });
    expect(await ensureInstallationId(root)).toBe("a720868e-d80a-4c71-96aa-2ce56936b35d");
    expect(await readFile(join(directory, "id.json"), "utf8")).toBe(existing);
  });

  it("refuses an invalid existing identity without replacing it", async () => {
    const root = await makeRoot();
    const directory = join(root, "installation");
    await mkdir(directory);
    await writeFile(join(directory, "id.json"), '{"installation_id":"invalid"}', { mode: 0o600 });
    await expect(checkInstallationId(root)).rejects.toThrow("existing file was left unchanged");
    await expect(ensureInstallationId(root)).rejects.toThrow("existing file was left unchanged");
    expect(await readFile(join(directory, "id.json"), "utf8")).toBe(
      '{"installation_id":"invalid"}'
    );
  });

  it("checks an absent installation without creating one", async () => {
    const root = await makeRoot();
    expect(await checkInstallationId(root)).toBeNull();
    expect(await readdir(root)).toEqual([]);
  });

  it.each([
    '{"installation_id":"prefix-a720868e-d80a-4c71-96aa-2ce56936b35d"}',
    '{"installation_id":"a720868e-d80a-4c71-96aa-2ce56936b35d-suffix"}',
    '{"installation_id":"a720868e-d80a-1c71-96aa-2ce56936b35d"}',
    '{"installation_id":null}',
    "{}",
    "[]",
    "{invalid",
  ])("refuses malformed stored identity %s", async (stored) => {
    const root = await makeRoot();
    const directory = join(root, "installation");
    await mkdir(directory);
    await writeFile(join(directory, "id.json"), stored, { mode: 0o600 });
    await expect(checkInstallationId(root)).rejects.toThrow("existing file was left unchanged");
    await expect(ensureInstallationId(root)).rejects.toThrow("existing file was left unchanged");
    expect(await readFile(join(directory, "id.json"), "utf8")).toBe(stored);
  });

  it("refuses to initialize when the parent is not a directory", async () => {
    const root = await makeRoot();
    await writeFile(join(root, "installation"), "not a directory");
    if (process.platform === "win32") await expect(checkInstallationId(root)).resolves.toBeNull();
    else await expect(checkInstallationId(root)).rejects.toMatchObject({ code: "ENOTDIR" });
    await expect(ensureInstallationId(root)).rejects.toThrow();
    expect(await readFile(join(root, "installation"), "utf8")).toBe("not a directory");
  });

  it.skipIf(process.platform === "win32")("rejects a directory as the identity file", async () => {
    const root = await makeRoot();
    await mkdir(join(root, "installation", "id.json"), { recursive: true });
    await expect(checkInstallationId(root)).rejects.toThrow("private regular file");
  });

  it.skipIf(process.platform === "win32")("refuses a symlink without following it", async () => {
    const root = await makeRoot();
    const directory = join(root, "installation");
    await mkdir(directory);
    const target = join(root, "target.json");
    await writeFile(target, "untouched", { mode: 0o600 });
    await symlink(target, join(directory, "id.json"));
    await expect(ensureInstallationId(root)).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe("untouched");
  });

  it.skipIf(process.platform === "win32")(
    "refuses an existing file with broad permissions",
    async () => {
      const root = await makeRoot();
      const directory = join(root, "installation");
      await mkdir(directory);
      await writeFile(
        join(directory, "id.json"),
        '{"installation_id":"a720868e-d80a-4c71-96aa-2ce56936b35d"}',
        { mode: 0o644 }
      );
      await chmod(join(directory, "id.json"), 0o644);
      await expect(ensureInstallationId(root)).rejects.toThrow("private regular file");
    }
  );

  it("reports an already applied OTLP configuration if identity creation then fails", async () => {
    await expect(
      finishInstallationId(async () => {
        throw new Error("disk full");
      }, "OTLP configuration completed")
    ).rejects.toThrow(
      "OTLP configuration completed, but the installation ID could not be saved: disk full"
    );
  });

  it("reports non-Error failures after the earlier action already succeeded", async () => {
    await expect(
      finishInstallationId(async () => {
        throw "disk full";
      }, "Measurement is on")
    ).rejects.toThrow("Measurement is on, but the installation ID could not be saved: disk full");
  });
});
