import type { FrameworkDescriptor } from "../models/framework.js";

export interface FrameworkLoader {
  loadFromDirectory(
    path: string,
    version: string
  ): Promise<{
    descriptor: FrameworkDescriptor;
    contentFiles: Map<string, string>;
    docsFiles: Map<string, string>;
  }>;
}
