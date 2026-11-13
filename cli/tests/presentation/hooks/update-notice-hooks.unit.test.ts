import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogOf } from "../../contexts/tools/testing/catalog-of.js";

const printNotice = vi.fn(async () => ({ lines: ["CLI update available"] }));
const warn = vi.fn();

vi.mock("../../../src/runtime/wiring/framework.js", () => ({
  createDeps: vi.fn(async () => ({
    printUpdateNotice: { execute: printNotice },
    refreshUpdateCheck: { execute: async () => ({}) },
    logger: { warn },
  })),
}));

const { registerUpdateNoticeHooks } = await import(
  "../../../src/presentation/hooks/update-notice-hooks.js"
);

async function run(name: string): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerUpdateNoticeHooks(program, catalogOf());
  program.command(name).action(() => undefined);
  await program.parseAsync(["node", "aidd", name]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AIDD_SKIP_UPDATE_CHECK", "");
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
});
