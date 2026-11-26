import { describe, expect, it, vi } from "vitest";
import { MenuLoop } from "../../../src/orchestration/menu/menu-loop.use-case.js";
import type { CommandRunner, Pause } from "../../../src/orchestration/menu/menu-ports.js";

function menuChoosing(...commands: string[][]) {
  const execute = vi.fn();
  for (const command of commands) execute.mockResolvedValueOnce({ command });
  return { execute };
}

function ports(exitCode = 0): { runner: CommandRunner; pause: Pause; steps: string[] } {
  const steps: string[] = [];
  return {
    steps,
    runner: {
      run: (argv) => {
        steps.push(`run ${argv.join(" ")}`);
        return Promise.resolve(exitCode);
      },
    },
    pause: {
      untilEnter: () => {
        steps.push("pause");
        return Promise.resolve();
      },
    },
  };
}

describe("run menu", () => {
  it("ends with 0 and runs nothing when the menu answers exit", async () => {
    const { runner, pause, steps } = ports();

    const code = await new MenuLoop(menuChoosing(["exit"]), runner, pause).execute();

    expect(code).toBe(0);
    expect(steps).toEqual([]);
  });

  it("pauses after each command, then offers the menu again", async () => {
    const { runner, pause, steps } = ports();
    const menu = menuChoosing(["doctor"], ["sync"], ["exit"]);

    await new MenuLoop(menu, runner, pause).execute();

    expect(steps).toEqual(["run doctor", "pause", "run sync", "pause"]);
    expect(menu.execute).toHaveBeenCalledTimes(3);
  });

  it("ends with a failed setup's own exit code", async () => {
    const { runner, pause } = ports(3);

    const code = await new MenuLoop(menuChoosing(["setup"]), runner, pause).execute();

    expect(code).toBe(3);
  });

  it("keeps offering the menu after a setup that succeeded", async () => {
    const { runner, pause } = ports(0);
    const menu = menuChoosing(["setup"], ["exit"]);

    expect(await new MenuLoop(menu, runner, pause).execute()).toBe(0);
    expect(menu.execute).toHaveBeenCalledTimes(2);
  });

  it("keeps offering the menu after another command failed", async () => {
    const { runner, pause } = ports(1);
    const menu = menuChoosing(["sync"], ["exit"]);

    expect(await new MenuLoop(menu, runner, pause).execute()).toBe(0);
    expect(menu.execute).toHaveBeenCalledTimes(2);
  });
});
