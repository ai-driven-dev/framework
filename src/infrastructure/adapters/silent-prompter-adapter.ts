import type { Prompter, SelectChoice } from "../../domain/ports/prompter.js";

export class SilentPrompterAdapter implements Prompter {
  async confirm(_message: string): Promise<boolean> {
    return true;
  }

  async select(_message: string, choices: SelectChoice[]): Promise<string> {
    if (choices.length === 0) {
      throw new Error("SilentPrompterAdapter.select called with empty choices.");
    }
    return choices[0].value;
  }

  async checkbox(_message: string, choices: SelectChoice[]): Promise<string[]> {
    return choices.map((c) => c.value);
  }
}
