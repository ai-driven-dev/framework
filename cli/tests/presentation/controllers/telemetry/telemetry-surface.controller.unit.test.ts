import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { commandOf } from "../../../../src/presentation/controllers/telemetry/telemetry-surface.controller.js";
import { processOutputFactory } from "../../../shared/testing/output-factory.builder.js";
import { createDeps } from "../../../shared/testing/telemetry-command.builder.js";

function surfaceOf() {
  const program = new Command();
  bindOutput(program, processOutputFactory());
  createDeps.mockClear();
  return { program, createDeps };
}

describe("commandOf", () => {
  it("wires the dependencies only when the work runs", async () => {
    const { program, createDeps } = surfaceOf();
    const { run } = commandOf(program, createDeps);
    expect(createDeps).not.toHaveBeenCalled();

    const work = vi.fn(async (_deps: unknown, _checked?: unknown) => undefined);
    await run(work);

    expect(createDeps).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledOnce();
  });

  it("checks the request before it wires anything, and hands the checked value to the work", async () => {
    const { program, createDeps } = surfaceOf();
    const { runChecked } = commandOf(program, createDeps);
    const work = vi.fn(async (_deps: unknown, _checked?: unknown) => undefined);

    await runChecked(() => "checked", work);

    expect(work.mock.calls[0]?.[1]).toBe("checked");

    createDeps.mockClear();
    await expect(
      runChecked(() => {
        throw new Error("refused");
      }, work)
    ).rejects.toThrow("refused");
    expect(createDeps).not.toHaveBeenCalled();
  });
});
