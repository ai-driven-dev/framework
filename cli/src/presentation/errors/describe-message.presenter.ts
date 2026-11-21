import type { HintedMessage, MessageHint } from "../../shared/domain/describe-error.js";

/** Each hint with the separator that joins it to the text it closes. */
const HINT_WORDS: Record<MessageHint, string> = {
  "full-removal": "; full removal is `aidd clean` in each of them, then `aidd clean --scope user`.",
  "purge-user-scope": " — `aidd clean --scope user` is what purges it for the machine.",
  "update-cli":
    " Run `aidd update` to bring this project's CLI to at least the version the host already follows.",
  "sync-after-path": " — run `aidd sync` again once every tool's CLI is on PATH.",
  "sync-after-build": " — fix the build warning above, then run `aidd sync` again.",
  "rerun-setup-global": " Rerun `aidd setup --global` once it is installed.",
};

/** The words of a message, its hint included. */
export function describeMessage(message: string | HintedMessage): string {
  if (typeof message === "string") return message;
  return message.hint === undefined ? message.text : message.text + HINT_WORDS[message.hint];
}
