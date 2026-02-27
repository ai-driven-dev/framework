import type { FrameworkDescriptor } from "../models/framework-descriptor.js";

export interface FrameworkLoader {
  loadFromDirectory(path: string): Promise<{
    descriptor: FrameworkDescriptor;
    contentFiles: Map<string, string>;
  }>;
}
