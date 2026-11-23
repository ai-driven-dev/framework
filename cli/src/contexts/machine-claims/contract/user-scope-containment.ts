import type { PathContainment } from "../../../shared/domain/paths.model.js";

/** The containment rule a machine-scope write must satisfy: strictly inside, never the boundary. */
export type IsWithinUserScope = PathContainment;
