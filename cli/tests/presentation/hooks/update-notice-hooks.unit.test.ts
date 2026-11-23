import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindOutput } from "../../../src/presentation/controllers/menu/global-options.controller.js";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { processOutputFactory } from "../../shared/testing/output-factory.builder.js";
import { parseToExit } from "../../shared/testing/parse-to-exit.builder.js";

const printNotice = vi.fn(async () => ({ notice: { current: "1.0.0", latest: "2.0.0" } }));
const refresh = vi.fn(async () => ({ checkedAt: 0, latest: "0.0.0" }));
const warn = vi.fn();
const debug = vi.fn();
const info = vi.fn();

const { registerUpdateNoticeHooks } = await import(
  "../../../src/presentation/hooks/update-notice-hooks.js"
);
const containerOf = vi.fn<Parameters<typeof registerUpdateNoticeHooks>[1]>();

/** Runs `path` as nested commands (`marketplace list` is a `list` under `marketplace`). */
async function run(
  path: string,
  extraArgs: string[] = [],
  action: () => void = () => undefined
): Promise<void> {
  const program = new Command("aidd");
  bindOutput(program, processOutputFactory());
  program.option("--verbose");
  program.exitOverride();
  registerUpdateNoticeHooks(program, containerOf);
  let parent = program;
  const names = path.split(" ");
  for (const name of names.slice(0, -1)) parent = parent.command(name);
  parent.command(names[names.length - 1] as string).action(action);
  await parseToExit(program, ["node", "aidd", ...extraArgs, ...names]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AIDD_SKIP_UPDATE_CHECK", "");
  containerOf.mockImplementation(async () => ({
    update: {
      printUpdateNotice: { execute: printNotice },
      refreshUpdateCheck: { execute: refresh },
    },
    shared: { logger: { warn, debug, info } },
  }));
});

describe("the update notice hook", () => {
  it("warns with the notice before a command", async () => {
    await run("sync");
    expect(warn.mock.calls.map(([line]) => line)).toStrictEqual([
      "CLI update available: v1.0.0 → v2.0.0",
      "Run `aidd update`.",
    ]);
  });

  it("stays silent before `update`, which resolves the latest version itself", async () => {
    await run("update");
    expect(printNotice).not.toHaveBeenCalled();
  });

  it("stays silent when the update check is switched off", async () => {
    vi.stubEnv("AIDD_SKIP_UPDATE_CHECK", "1");
    await run("sync");
    expect(containerOf).not.toHaveBeenCalled();
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
    expect(containerOf).toHaveBeenCalledWith(
      process.cwd(),
      { verbose: true },
      expect.objectContaining({ verbose: true })
    );
  });

  it("builds quiet dependencies without the verbose flag", async () => {
    await run("sync");
    expect(containerOf).toHaveBeenCalledWith(
      process.cwd(),
      { verbose: false },
      expect.objectContaining({ verbose: false })
    );
  });

  it("does nothing when the dependencies cannot be built", async () => {
    containerOf.mockRejectedValue(new Error("no project"));
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
    expect(containerOf).toHaveBeenLastCalledWith(
      process.cwd(),
      { verbose: true },
      expect.objectContaining({ verbose: true })
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

describe("a command that fails", () => {
  it("reports the failure at the one exit, with code 1, and refreshes nothing", async () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code));
    });

    await expect(
      run("marketplace refresh", [], () => {
        throw new Error("registry unreachable");
      })
    ).rejects.toThrow(ExitRequested);

    expect(written.join("")).toBe("Error: registry unreachable\n");
    expect(exit).toHaveBeenCalledWith(1);
    expect(refresh).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
