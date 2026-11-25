import type { OutputFactory } from "../../../src/presentation/controllers/menu/global-options.controller.js";
import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import { OutputAdapter } from "../../../src/presentation/terminal/output.adapter.js";

/** The output factory the binary builds: it ends the run through `process.exit`, which a test spies. */
export function processOutputFactory(): OutputFactory {
  return (verbose) =>
    new OutputAdapter(verbose, (code) => process.exit(code), String, describeMessage);
}
