import { describe, expect, it } from "vitest";
import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import type { MessageHint } from "../../../src/shared/domain/describe-error.js";

describe("describing an error message", () => {
  it("leaves a plain message as it is", () => {
    expect(describeMessage("done")).toBe("done");
  });

  it("leaves a hinted message without a hint as its text", () => {
    expect(describeMessage({ text: "done" })).toBe("done");
  });

  it.each<[MessageHint, string]>([
    [
      "full-removal",
      "t; full removal is `aidd clean` in each of them, then `aidd clean --scope user`.",
    ],
    ["purge-user-scope", "t — `aidd clean --scope user` is what purges it for the machine."],
    [
      "update-cli",
      "t Run `aidd update` to bring this project's CLI to at least the version the host already follows.",
    ],
    ["sync-after-path", "t — run `aidd sync` again once every tool's CLI is on PATH."],
    ["sync-after-build", "t — fix the build warning above, then run `aidd sync` again."],
    ["rerun-setup-global", "t Rerun `aidd setup --global` once it is installed."],
  ])("words the hint %s after the text", (hint, words) => {
    expect(describeMessage({ text: "t", hint })).toBe(words);
  });
});
