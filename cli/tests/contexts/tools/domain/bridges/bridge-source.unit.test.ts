import { describe, expect, it } from "vitest";
import {
  ANSWER_FROM_SOURCE,
  hooksDirDeclaration,
  MATCHES_TOOL_SOURCE,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-source.js";

/** Evaluates a piece of generated module source with the names it reads, and hands back what it declares. */
function evaluated<T>(source: string, declared: string, scope: Record<string, unknown> = {}): T {
  return new Function(...Object.keys(scope), `${source}\nreturn ${declared};`)(
    ...Object.values(scope)
  );
}

describe("the source every generated bridge writes the same way", () => {
  const answerFrom = evaluated<(code: number | null, stdout: string, stderr: string) => string>(
    ANSWER_FROM_SOURCE,
    "answerFrom"
  );

  it("reads a script's stderr as its answer on exit code 2", () => {
    expect(answerFrom(2, "", " why \n")).toBe("why");
  });

  it("reads the additionalContext of a script that exits 0, nothing for any other exit", () => {
    const stdout = JSON.stringify({ hookSpecificOutput: { additionalContext: " noted " } });

    expect([
      answerFrom(0, stdout, ""),
      answerFrom(1, stdout, ""),
      answerFrom(0, "text", ""),
    ]).toEqual(["noted", "", ""]);
  });

  it("matches a tool name ignoring case, any tool when no matcher is given", () => {
    const matchesTool = evaluated<(matcher: string | undefined, tool: string) => boolean>(
      MATCHES_TOOL_SOURCE,
      "matchesTool"
    );

    expect([
      matchesTool(undefined, "bash"),
      matchesTool("Write|Edit", "edit"),
      matchesTool("Write|Edit", "bash"),
    ]).toEqual([true, true, false]);
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
