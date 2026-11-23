import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { bindOutput } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { commandOf } from "../../../../src/presentation/controllers/telemetry/telemetry-surface.controller.js";
import { processOutputFactory } from "../../../shared/testing/output-factory.builder.js";
import { containerOf } from "../../../shared/testing/telemetry-command.builder.js";

function surfaceOf() {
  const program = new Command();
  bindOutput(program, processOutputFactory());
  containerOf.mockClear();
  return { program, containerOf };
}

describe("running a telemetry command", () => {
  it("wires the dependencies only when the work runs", async () => {
    const { program, containerOf } = surfaceOf();
    const { run } = commandOf(program, containerOf);
    expect(containerOf).not.toHaveBeenCalled();

    const work = vi.fn(async (_deps: unknown, _checked?: unknown) => undefined);
    await run(work);

    expect(containerOf).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledOnce();
  });

  it("checks the request before it wires anything, and hands the checked value to the work", async () => {
    const { program, containerOf } = surfaceOf();
    const { runChecked } = commandOf(program, containerOf);
    const work = vi.fn(async (_deps: unknown, _checked?: unknown) => undefined);

    await runChecked(() => "checked", work);

    expect(work.mock.calls[0]?.[1]).toBe("checked");

    containerOf.mockClear();
    await expect(
      runChecked(() => {
        throw new Error("refused");
      }, work)
    ).rejects.toThrow("refused");
    expect(containerOf).not.toHaveBeenCalled();
  });
});
