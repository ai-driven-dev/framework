export interface RecordedStep {
  id: string;
  args: string[];
  status: number | null;
  stdout: string;
  stderr: string;
  files: Record<string, string>;
  tree?: string[];
}

export interface HostRecording {
  host: string;
  version: string;
  steps: RecordedStep[];
}

export interface HostSandbox {
  work: string;
  home: string;
  proj: string;
  markets: string;
  env: Record<string, string>;
  dispose(): void;
}

export const RECORDED_HOSTS: string[];
export function hostVersion(host: string): string | undefined;
export function createSandbox(): HostSandbox;
export function writeMarketplace(host: string, dir: string, plugin?: string): void;
export function recordHost(host: string): HostRecording;
