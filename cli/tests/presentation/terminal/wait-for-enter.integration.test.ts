import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { waitForEnter } from "../../../src/presentation/terminal/wait-for-enter.js";

describe("waiting for ENTER", () => {
  it("shows the prompt and stays pending until ENTER is pressed", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let released = false;

    const waiting = waitForEnter({ input, output }).then(() => {
      released = true;
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(output.read()?.toString()).toContain("Press ENTER to continue...");
    expect(released).toBe(false);

    input.write("\n");
    await waiting;

    expect(released).toBe(true);
  });
});
