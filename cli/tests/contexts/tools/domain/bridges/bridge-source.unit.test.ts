import { describe, expect, it } from "vitest";
import {
  ANSWER_OF_SOURCE,
  hooksDirDeclaration,
  reportHookFailureSource,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-source.js";

/** Evaluates a piece of generated module source with the names it reads, and hands back what it declares. */
function evaluated<T>(source: string, declared: string, scope: Record<string, unknown> = {}): T {
  return new Function(...Object.keys(scope), `${source}\nreturn ${declared};`)(
    ...Object.values(scope)
  );
}

describe("the source every generated bridge writes the same way", () => {
  const answerFrom = evaluated<
    (code: number | null, stdout: string, stderr: string) => { text: string; person: string }
  >(ANSWER_OF_SOURCE, "answerFrom");

  it("reads a script's stderr as its answer on exit code 2", () => {
    expect(answerFrom(2, "", " why \n").text).toBe("why");
  });

  it("reads the additionalContext a script that exits 0 prints, nothing of text that is no JSON", () => {
    expect([
      answerFrom(0, JSON.stringify({ additionalContext: " noted " }), "").text,
      answerFrom(0, "text", "").text,
    ]).toEqual(["noted", ""]);
  });

  it("reads the person's message of a script that exits 0 apart from what the model reads", () => {
    expect(answerFrom(0, JSON.stringify({ systemMessage: " hi " }), "")).toEqual({
      text: "",
      person: "hi",
      required: false,
    });
  });

  describe("a script's answer, awaited", () => {
    const answered = async (done: Record<string, unknown>) => {
      const reported: unknown[][] = [];
      const answerOf = evaluated<(...args: unknown[]) => Promise<{ text: string }>>(
        ANSWER_OF_SOURCE,
        "answerOf",
        {
          runCapture: async () => ({ stdout: "", stderr: "", signal: null, ...done }),
          reportHookFailure: (...args: unknown[]) => reported.push(args),
          exitDescription: evaluated(reportHookFailureSource("Probe"), "exitDescription"),
        }
      );
      return { answer: (await answerOf("a.cjs", [], {}, "/p")).text, reported };
    };

    it("reports a script that exits other than 0 or 2 by its code, and answers nothing", async () => {
      expect(await answered({ code: 1, stderr: "boom" })).toEqual({
        answer: "",
        reported: [["a.cjs", "exited with code 1"]],
      });
    });

    it("reports a script that was killed by the signal that ended it", async () => {
      expect((await answered({ code: null, signal: "SIGTERM" })).reported).toEqual([
        ["a.cjs", "exited with code null (SIGTERM)"],
      ]);
    });

    it("reports a script that never ran by the error it failed with", async () => {
      expect((await answered({ code: null, error: "ENOENT" })).reported).toEqual([
        ["a.cjs", "ENOENT"],
      ]);
    });

    it("reports nothing of a script that exits 0", async () => {
      expect((await answered({ code: 0 })).reported).toEqual([]);
    });
  });

  it("names the host and the script a failure is reported on", () => {
    const warned: string[] = [];
    const report = evaluated<(script: string, error: unknown) => void>(
      reportHookFailureSource("Probe"),
      "reportHookFailure",
      { console: { warn: (line: string) => warned.push(line) } }
    );

    report("a.cjs", "boom");

    expect(warned).toEqual(["[aidd] Probe hook a.cjs failed: boom"]);
  });

  it("resolves the scripts folder of a plugin from the module's own url", () => {
    const declaration = hooksDirDeclaration("probe").replace(
      "import.meta.url",
      JSON.stringify("file:///host/plugin/bridge.mjs")
    );

    expect(
      evaluated<string>(declaration, "HOOKS_DIR", {
        fileURLToPath: (url: URL) => url.pathname,
      })
    ).toBe("/host/hooks/probe/");
  });
});
