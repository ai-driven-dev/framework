import { expect } from "vitest";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";

/** Matches a thrown error by the words the CLI says for it, which the error class no longer carries. */
export function saying(words: string | RegExp) {
  return expect.toSatisfy((thrown: unknown) => {
    const said = render(thrown);
    return typeof words === "string" ? said.includes(words) : words.test(said);
  });
}
