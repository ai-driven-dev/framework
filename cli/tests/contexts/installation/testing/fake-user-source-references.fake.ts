/** The projects on the machine that still reference the shared machine-scope source, as each test
 * states them. Recording a reference changes nothing: only who is listed matters to what reads it. */
export class FakeUserSourceReferences {
  constructor(private readonly referencing: readonly string[]) {}

  async addReference(_version: string, _projectRoot: string): Promise<void> {}

  async removeReference(_projectRoot: string): Promise<void> {}

  async listAllReferencingProjects(): Promise<readonly string[]> {
    return this.referencing;
  }
}
