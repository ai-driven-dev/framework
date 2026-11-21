/** Plants for the token-owner plugin: only the auth context reads the token variable. */
import type { Plant } from "./biome-plants.js";

const OUTSIDE_AUTH = "src/contexts/update/infrastructure";
export const TOKEN_PLANTS: readonly Plant[] = [
  [`${OUTSIDE_AUTH}/reads.ts`, "export const t = process.env.AIDD_TOKEN;\n", "plugin", 1],
  [`${OUTSIDE_AUTH}/names.ts`, 'export const n = "AIDD_TOKEN";\n', "plugin", 1],
  [`${OUTSIDE_AUTH}/uses.ts`, "export const n = TOKEN_VARIABLE;\n", "plugin", 1],
  [
    "src/contexts/auth/infrastructure/reads.ts",
    "export const t = process.env.AIDD_TOKEN;\n",
    "plugin",
    0,
  ],
  ["src/presentation/errors/says.ts", 'export const h = "Set AIDD_TOKEN, run it";\n', "plugin", 0],
];
