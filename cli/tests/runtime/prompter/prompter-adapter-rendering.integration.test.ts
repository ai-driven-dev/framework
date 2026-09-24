import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../../../src/runtime/prompter/prompter-adapter.js";

const ENTER = "\n";
const ARROW_DOWN = "\x1b[B";

function makeAdapter() {
  const inputStream = new PassThrough();
  const outputStream = new PassThrough();
  const rendered: string[] = [];
  outputStream.on("data", (chunk: Buffer) => rendered.push(chunk.toString()));
  const adapter = new InquirerPrompterAdapter({ input: inputStream, output: outputStream });
  return { adapter, inputStream, screen: () => rendered.join("") };
}

function press(inputStream: PassThrough, ...keys: string[]): void {
  let delay = 0;
  for (const key of keys) {
    delay += 20;
    setTimeout(() => inputStream.write(key), delay);
  }
}

describe("SilentPrompterAdapter, conflicts", () => {
  const adapter = new SilentPrompterAdapter();

  it("overwrites a single conflict", async () => {
    expect(await adapter.resolveConflict("a.md", "modified")).toBe("overwrite");
  });

  it("overwrites a bulk conflict, one at a time", async () => {
    expect(await adapter.resolveConflictBulk("a.md", "deleted")).toBe("overwrite");
  });
});

describe("InquirerPrompterAdapter, what the screen says", () => {
  it("names the file and that it was deleted", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.resolveConflict("a.md", "deleted");
    press(inputStream, ENTER);
    await result;

    expect(screen()).toContain("Conflict: a.md was deleted. What do you want to do?");
  });

  it("names the file and that it was locally modified", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.resolveConflict("a.md", "modified");
    press(inputStream, ENTER);
    await result;

    expect(screen()).toContain("Conflict: a.md was locally modified. What do you want to do?");
  });

  it("offers overwrite and keep for a single conflict", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.resolveConflict("a.md", "modified");
    press(inputStream, ENTER);
    await result;

    expect(screen()).toContain("Overwrite with latest version");
    expect(screen()).toContain("Keep my local version");
  });

  it("offers the two bulk answers as well for a bulk conflict", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.resolveConflictBulk("a.md", "modified");
    press(inputStream, ENTER);
    await result;

    expect(screen()).toContain("Overwrite with latest version");
    expect(screen()).toContain("Keep my local version");
    expect(screen()).toContain("Overwrite all remaining conflicts");
    expect(screen()).toContain("Skip all remaining conflicts");
  });

  it("marks a choice disabled without a reason as Disabled", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.select("Pick", [
      { name: "first", value: 1, disabled: true },
      { name: "second", value: 2 },
    ]);
    press(inputStream, ARROW_DOWN, ENTER);
    await result;

    expect(screen()).toContain("first Disabled");
  });

  it("shows the reason a choice is disabled", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.select("Pick", [
      { name: "first", value: 1, disabled: "not installed" },
      { name: "second", value: 2 },
    ]);
    press(inputStream, ARROW_DOWN, ENTER);
    await result;

    expect(screen()).toContain("first not installed");
  });
});

describe("InquirerPrompterAdapter, bulk conflict answers", () => {
  it("answers overwrite on Enter", async () => {
    const { adapter, inputStream } = makeAdapter();
    const result = adapter.resolveConflictBulk("a.md", "modified");
    press(inputStream, ENTER);

    expect(await result).toBe("overwrite");
  });

  it("answers keep one step down", async () => {
    const { adapter, inputStream } = makeAdapter();
    const result = adapter.resolveConflictBulk("a.md", "modified");
    press(inputStream, ARROW_DOWN, ENTER);

    expect(await result).toBe("keep");
  });

  it("answers overwrite-all two steps down", async () => {
    const { adapter, inputStream } = makeAdapter();
    const result = adapter.resolveConflictBulk("a.md", "modified");
    press(inputStream, ARROW_DOWN, ARROW_DOWN, ENTER);

    expect(await result).toBe("overwrite-all");
  });

  it("answers skip-all three steps down", async () => {
    const { adapter, inputStream } = makeAdapter();
    const result = adapter.resolveConflictBulk("a.md", "modified");
    press(inputStream, ARROW_DOWN, ARROW_DOWN, ARROW_DOWN, ENTER);

    expect(await result).toBe("skip-all");
  });
});

describe("InquirerPrompterAdapter, a disabled choice", () => {
  it("refuses Enter, so the answer is the next enabled one", async () => {
    const { adapter, inputStream, screen } = makeAdapter();
    const result = adapter.select("Pick", [
      { name: "first", value: 1, disabled: "not installed" },
      { name: "second", value: 2 },
    ]);
    press(inputStream, ENTER, ARROW_DOWN, ENTER);

    expect(await result).toBe(2);
    expect(screen()).toContain("This option is disabled and cannot be selected.");
  });
});
