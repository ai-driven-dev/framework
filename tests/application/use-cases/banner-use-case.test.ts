import { describe, expect, it, vi } from "vitest";
import { BannerUseCase } from "../../../src/application/use-cases/banner-use-case.js";

function makeMockStream(isTTY: boolean): NodeJS.WriteStream {
  return {
    isTTY,
    write: vi.fn(),
  } as unknown as NodeJS.WriteStream;
}

describe("BannerUseCase", () => {
  it("writes nothing when stream is not a TTY", async () => {
    const out = makeMockStream(false);
    await new BannerUseCase(out).execute();
    expect(out.write).not.toHaveBeenCalled();
  });

  it("writes output when stream is a TTY", async () => {
    vi.useFakeTimers();
    const out = makeMockStream(true);

    const executePromise = new BannerUseCase(out).execute();
    await vi.runAllTimersAsync();
    await executePromise;

    expect(out.write).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("includes AI-Driven Development in the output", async () => {
    vi.useFakeTimers();
    const out = makeMockStream(true);
    const calls: string[] = [];
    (out.write as ReturnType<typeof vi.fn>).mockImplementation((s: string) => {
      calls.push(s);
    });

    const executePromise = new BannerUseCase(out).execute();
    await vi.runAllTimersAsync();
    await executePromise;

    const output = calls.join("");
    expect(output).toContain("AI-Driven Development");
    expect(output).toContain("AI-Driven Dev");
    vi.useRealTimers();
  });
});
