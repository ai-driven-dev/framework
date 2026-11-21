import type {
  MachineInstallationView,
  ReadMachineInstallation,
} from "../../contexts/installation/application/doctor/read-machine-installation.js";
import type { DoctorIssue } from "../../contexts/installation/contract/doctor-issue.js";
import { UserScopeFilterUnsupportedError } from "../orchestration.error.js";
import type { CheckRegistration } from "./check-registration.js";

export interface RunUserScopeDoctorCommand {
  projectRoot: string;
  tool?: string;
  plugin?: string;
}

export interface RunUserScopeDoctorReport {
  /** What the machine has registered, known before the registrations are checked against it. */
  registered(machine: MachineInstallationView): void;
}

/** A user-scope install writes nothing under any project, so the only check left is the
 * registrations against the user manifest: versus a host's own registry file, the one check
 * that is not project-file-shaped. Nothing registered answers `null`. */
export class RunUserScopeDoctor {
  constructor(
    private readonly machine: Pick<ReadMachineInstallation, "execute">,
    private readonly registrations: Pick<CheckRegistration, "execute">
  ) {}

  async execute(
    { projectRoot, tool, plugin }: RunUserScopeDoctorCommand,
    report: RunUserScopeDoctorReport
  ): Promise<DoctorIssue[] | null> {
    // At user scope doctor checks registrations, not plugin files: there is nothing `--plugin`
    // could narrow: so it is refused rather than silently read and discarded.
    if (plugin !== undefined) {
      throw new UserScopeFilterUnsupportedError("--plugin", "doctor --plugin <name>");
    }
    const machine = await this.machine.execute();
    if (machine === null) return null;
    report.registered(machine);
    return this.registrations.execute({
      projectRoot,
      allowedIds: tool === undefined ? null : new Set([tool]),
      globalInstall: true,
    });
  }
}
