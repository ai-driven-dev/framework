import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentModelStoreAdapter } from "../../../../src/contexts/installation/infrastructure/agent-model-store-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false
  );

describe("storing the agent models on disk", () => {
  let dir: string;
  let store: AgentModelStoreAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aidd-agent-models-"));
    store = new AgentModelStoreAdapter(new FileAdapter(), () => dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads a missing file as empty", async () => {
    expect(await store.loadProviders()).toStrictEqual({});
    expect(await store.loadMainModels()).toStrictEqual({});
  });

  it("keeps the providers in agent-models.json and the main models in main-model.json", async () => {
    const record = { path: "/p", written: { model: "x" }, previous: {}, created: true };

    await store.saveProviders({ claude: "anthropic" });
    await store.saveMainModels({ claude: record });

    expect(JSON.parse(await readFile(join(dir, "agent-models.json"), "utf-8"))).toStrictEqual({
      claude: "anthropic",
    });
    expect(JSON.parse(await readFile(join(dir, "main-model.json"), "utf-8"))).toStrictEqual({
      claude: record,
    });
    expect(await store.loadProviders()).toStrictEqual({ claude: "anthropic" });
    expect(await store.loadMainModels()).toStrictEqual({ claude: record });
  });

  it("writes indented JSON ending in a newline", async () => {
    await store.saveProviders({ claude: "anthropic" });

    expect(await readFile(join(dir, "agent-models.json"), "utf-8")).toBe(
      `${JSON.stringify({ claude: "anthropic" }, null, 2)}\n`
    );
  });

  it("deletes the file when what is saved is empty", async () => {
    await store.saveProviders({ claude: "anthropic" });

    await store.saveProviders({});

    expect(await exists(join(dir, "agent-models.json"))).toBe(false);
  });

  it("writes no file when nothing was ever saved and the save is empty", async () => {
    await store.saveMainModels({});

    expect(await exists(join(dir, "main-model.json"))).toBe(false);
  });

  it("names the file when its content is not JSON", async () => {
    const path = join(dir, "agent-models.json");
    await writeFile(path, "{ nope");

    await expect(store.loadProviders()).rejects.toThrow(`${path} is not valid JSON`);
  });

  it.each([
    ["an array", "[]"],
    ["a string", '"x"'],
    ["null", "null"],
  ])("refuses a file holding %s instead of an object", async (_name, content) => {
    const path = join(dir, "main-model.json");
    await mkdir(dir, { recursive: true });
    await writeFile(path, content);

    await expect(store.loadMainModels()).rejects.toThrow(`${path} must contain a JSON object.`);
  });
});
