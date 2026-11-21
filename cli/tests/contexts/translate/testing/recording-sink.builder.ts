import type {
  DiskTarget,
  PluginTreeSink,
  PluginWritten,
} from "../../../../src/contexts/translate/ports/plugin-tree-sink.js";

/** A sink that writes nothing and remembers what it was asked, one entry per call. */
export class RecordingSink implements PluginTreeSink {
  readonly calls: string[] = [];
  readonly targets: DiskTarget[] = [];

  constructor(private readonly filesPerPlugin = 1) {}

  async prepare(target: DiskTarget): Promise<void> {
    this.targets.push(target);
    this.calls.push("prepare");
  }

  async writePlugin(_target: DiskTarget, pluginName: string): Promise<PluginWritten> {
    this.calls.push(`write ${pluginName}`);
    return { files: this.filesPerPlugin, declaredMcp: null };
  }

  async finish(
    _target: DiskTarget,
    _sourceMarketplace: unknown,
    builtPlugins: readonly { name: string }[]
  ): Promise<number> {
    this.calls.push(`finish ${builtPlugins.map((p) => p.name).join(",")}`);
    return 2;
  }
}
