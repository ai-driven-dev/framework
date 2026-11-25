/** The files planted to watch presentation reach a context's errors through its contract only. */
import type { Plant } from "./biome-plants.js";

const CONTEXTS = [
  "auth",
  "distribution",
  "host-registration",
  "installation",
  "machine-claims",
  "telemetry",
  "tools",
  "translate",
  "update",
];

const reaches = (context: string, folder: string): string =>
  `import { E } from "../../contexts/${context}/${folder}/${context}.error.js";\nexport const e = E;\n`;

export const ERROR_PLANTS: readonly Plant[] = CONTEXTS.flatMap((context): Plant[] => [
  [
    `src/presentation/errors/reaches-${context}-domain.presenter.ts`,
    reaches(context, "domain"),
    "lint/style/noRestrictedImports",
    1,
  ],
  [
    `src/presentation/errors/reaches-${context}-contract.presenter.ts`,
    reaches(context, "contract"),
    "lint/style/noRestrictedImports",
    0,
  ],
]);
