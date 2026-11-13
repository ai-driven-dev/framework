import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

const printNotice = vi.fn(async () => ({ lines: ["CLI update available"] }));
const refresh = vi.fn(async () => ({}));
const warn = vi.fn();
const debug = vi.fn();
const createDeps = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: (...args: unknown[]) => createDeps(...args),
}));

const { registerUpdateNoticeHooks } = await import(
  "../../../src/presentation/hooks/update-notice-hooks.js"
);

/** Runs `path` as nested commands (`marketplace list` is a `list` under `marketplace`). */
async function run(path: string, extraArgs: string[] = []): Promise<void> {
  const program = new Command("aidd");
  program.option("--verbose");
  program.exitOverride();
  registerUpdateNoticeHooks(program, catalogOf());
  let parent = program;
  const names = path.split(" ");
  for (const name of names.slice(0, -1)) parent = parent.command(name);
  parent.command(names[names.length - 1] as string).action(() => undefined);
  await program.parseAsync(["node", "aidd", ...extraArgs, ...names]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AIDD_SKIP_UPDATE_CHECK", "");
  createDeps.mockImplementation(async () => ({
    printUpdateNotice: { execute: printNotice },
    refreshUpdateCheck: { execute: refresh },
    logger: { warn, debug },
  }));
});

describe("the update notice hook", () => {
  it("warns with the notice before a command", async () => {
    await run("sync");
    expect(warn).toHaveBeenCalledWith("CLI update available");
  });

  it("stays silent before `update`, which resolves the latest version itself", async () => {
    await run("update");
    expect(printNotice).not.toHaveBeenCalled();
  });

  it("stays silent when the update check is switched off", async () => {
    vi.stubEnv("AIDD_SKIP_UPDATE_CHECK", "1");
    await run("sync");
    expect(createDeps).not.toHaveBeenCalled();
    expect(printNotice).not.toHaveBeenCalled();
  });

  it("stays silent before a telemetry command, even a nested one", async () => {
    await run("telemetry ingest");
    expect(printNotice).not.toHaveBeenCalled();
  });

  it("still warns before a command whose path merely contains telemetry", async () => {
    await run("marketplace telemetry");
    expect(printNotice).toHaveBeenCalled();
  });

  it("builds its dependencies in the working directory with the verbose flag", async () => {
    await run("sync", ["--verbose"]);
    expect(createDeps).toHaveBeenCalledWith(
      process.cwd(),
      { verbose: true },
      expect.objectContaining({ verbose: true }),
      expect.anything()
    );
  });

  it("builds quiet dependencies without the verbose flag", async () => {
    await run("sync");
    expect(createDeps).toHaveBeenCalledWith(
      process.cwd(),
      { verbose: false },
      expect.objectContaining({ verbose: false }),
      expect.anything()
    );
  });

  it("does nothing when the dependencies cannot be built", async () => {
    createDeps.mockRejectedValue(new Error("no project"));
    await run("sync");
    expect(printNotice).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("logs a failed notice at debug level and lets the command run", async () => {
    printNotice.mockRejectedValueOnce(new Error("offline"));
    await run("sync");
    expect(debug).toHaveBeenCalledWith("CLI update check failed: offline");
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a notice failure that is not an Error by its string form", async () => {
    printNotice.mockRejectedValueOnce("boom");
    await run("sync");
    expect(debug).toHaveBeenCalledWith("CLI update check failed: boom");
  });
});

describe("the update refresh hook", () => {
  it.each([
    "marketplace refresh",
    "marketplace check",
    "marketplace list",
    "marketplace add",
    "sync",
  ])("refreshes the update check after `%s`", async (path) => {
    await run(path);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each(["marketplace remove", "update", "list"])(
    "does not refresh after the offline `%s`",
    async (path) => {
      await run(path);
      expect(refresh).not.toHaveBeenCalled();
    }
  );

  it("does not refresh when the update check is switched off", async () => {
    vi.stubEnv("AIDD_SKIP_UPDATE_CHECK", "1");
    await run("sync");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("builds its dependencies in the working directory with the verbose flag", async () => {
    await run("sync", ["--verbose"]);
    expect(createDeps).toHaveBeenLastCalledWith(
      process.cwd(),
      { verbose: true },
      expect.objectContaining({ verbose: true }),
      expect.anything()
    );
  });

  it("logs a failed refresh at debug level", async () => {
    refresh.mockRejectedValueOnce(new Error("rate limited"));
    await run("sync");
    expect(debug).toHaveBeenCalledWith("CLI update refresh failed: rate limited");
  });

  it("logs a refresh failure that is not an Error by its string form", async () => {
    refresh.mockRejectedValueOnce("nope");
    await run("sync");
    expect(debug).toHaveBeenCalledWith("CLI update refresh failed: nope");
  });
});
