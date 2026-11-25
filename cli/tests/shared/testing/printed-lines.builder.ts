import { CapturingOutput } from "./capturing-output.fake.js";

/** What a print function says to a non-interactive output, line by line. */
export const linesOf = (print: (output: CapturingOutput) => void): string[] => {
  const output = new CapturingOutput(false);
  print(output);
  return output.lines;
};
