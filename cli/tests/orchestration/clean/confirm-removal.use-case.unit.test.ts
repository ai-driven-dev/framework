import { describe, expect, it } from "vitest";
import { ConfirmRemoval } from "../../../src/orchestration/clean/confirm-removal.use-case.js";
import { RecordingPrompter } from "../../shared/testing/recording-prompter.fake.js";

describe("a removal that asks first", () => {
  it("goes ahead under --force without asking", async () => {
    const prompter = new RecordingPrompter(false);

    await expect(
      new ConfirmRemoval(prompter).execute({ force: true, interactive: true, question: "Q?" })
    ).resolves.toBe(true);

    expect(prompter.confirmMessages).toStrictEqual([]);
  });

  it("asks an interactive run and returns the answer", async () => {
    const yes = new RecordingPrompter(true);
    const no = new RecordingPrompter(false);

    const request = { force: false, interactive: true, question: "Remove?" };

    await expect(new ConfirmRemoval(yes).execute(request)).resolves.toBe(true);
    await expect(new ConfirmRemoval(no).execute(request)).resolves.toBe(false);
    expect(yes.confirmMessages).toStrictEqual(["Remove?"]);
  });

  it("stays a dry run when the run is not interactive or has no prompter", async () => {
    const prompter = new RecordingPrompter(true);

    await expect(
      new ConfirmRemoval(prompter).execute({ force: false, interactive: false, question: "Q?" })
    ).resolves.toBe(false);
    await expect(
      new ConfirmRemoval().execute({ force: false, interactive: true, question: "Q?" })
    ).resolves.toBe(false);
    expect(prompter.confirmMessages).toStrictEqual([]);
  });
});
