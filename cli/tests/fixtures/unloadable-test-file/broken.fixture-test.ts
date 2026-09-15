import { it } from "vitest";
import "./throws-on-load.js";

it("is never collected", () => {});
