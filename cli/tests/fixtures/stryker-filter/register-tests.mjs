import { appendFileSync } from "node:fs";
import { expect, it } from "vitest";

export function registerTests(file) {
  for (const name of ["left", "right"]) {
    it(name, () => {
      appendFileSync(process.env.FILTER_TRACE, `${file}#${name}\n`);
      expect(true).toBe(true);
    });
  }
}
