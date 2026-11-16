import type { PluginSourceMatch } from "../../contexts/distribution/contract/plugin-source-match.js";
import { AmbiguousPluginMatchError } from "../../shared/domain/errors.js";
import type { Prompter } from "../../shared/ports/prompter.js";

export interface WhichMatchQuestion {
  readonly pluginName: string;
  readonly matches: readonly PluginSourceMatch[];
  readonly interactive: boolean;
  /** Takes the first match without asking. */
  readonly autoSelect: boolean;
}

/** Which marketplace a plugin is taken from when several catalogue it. */
export async function askWhichMatch(
  prompter: Prompter,
  question: WhichMatchQuestion
): Promise<PluginSourceMatch> {
  const head = question.matches[0];
  if (question.matches.length === 1 && head !== undefined) return head;
  if (question.autoSelect && head !== undefined) return head;
  if (!question.interactive) {
    throw new AmbiguousPluginMatchError(
      question.pluginName,
      question.matches.map((m) => m.marketplaceName)
    );
  }
  return prompter.select(
    `Multiple matches for '${question.pluginName}'. Select one:`,
    question.matches.map((m) => ({
      name: `${m.marketplaceName} — ${m.entry.version ?? "?"}`,
      value: m,
    }))
  );
}
