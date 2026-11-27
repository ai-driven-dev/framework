import type { CloneIdentity } from "../domain/consent/clone-identity.js";
import type { ConsentLog } from "../domain/consent/consent-log.js";
import type { RememberedResolutions } from "../domain/remembered-resolutions.js";
import { cwdKey } from "../domain/repository-resolution.js";
import type { LocatedDirectory } from "../domain/resolution/located-directory.js";
import {
  type Directory,
  type DirectoryOutcome,
  directoryFrom,
  type ResolutionState,
  unreadableAt,
  verdictOn,
} from "../domain/resolution/resolution-judgement.js";
import { type CloneConsentReading, tokenOf } from "../domain/telemetry-consent.js";
import type { ConsentSource } from "../ports/consent-source.js";
import type { RepositoryLocator } from "../ports/repository-locator.js";

/** What the machine decides for a run: how it spells a directory, and what time it is. */
export interface ResolutionEnvironment {
  /** macOS and Windows file systems answer one directory to several spellings. */
  readonly caseInsensitiveFileSystem: boolean;
  readonly now: () => Date;
}

/** What a run starts from: what the store remembered, and the consent log as it was observed. */
export interface ResolutionStart {
  readonly remembered: RememberedResolutions;
  readonly consents: ConsentLog;
  readonly unreadable: ReadonlySet<string>;
}

/** What the machine answers a run: what a directory is, whether a clone is measured, the clock. */
interface ResolutionMachine {
  /** What a working directory is, as it stands now. */
  readonly locate: (cwd: string) => Promise<LocatedDirectory>;
  /** A clone's own word on whether it is measured. */
  readonly readClone: (clone: CloneIdentity) => Promise<CloneConsentReading>;
  readonly environment: ResolutionEnvironment;
}

/** The verdicts of one run on the directories a billed call was made in. */
export interface ResolutionRun {
  /** What this run learned about the directories it saw. */
  readonly learned: RememberedResolutions;
  /** The earliest instant a call can be covered at, in milliseconds: a transcript last written
   * before it holds nothing to store. Everything when the log cannot be trusted, so that each
   * call is still counted under its reason; nothing when no clone ever opted in. */
  readonly coveredFrom: number;
  /** This run's moment, for what has no time of its own. */
  readonly now: string;
  /** A line of the consent log was not an event: nothing is stored for any clone. */
  readonly consentLogDamaged: boolean;
  /** The verdict on a call made in `cwd` at `at`. */
  resolve(cwd: string, at: string): Promise<DirectoryOutcome>;
}

const closedIntervalOf =
  (consents: ConsentLog, readClone: ResolutionMachine["readClone"]) =>
  async (clone: CloneIdentity): Promise<boolean> => {
    return consents.hasClosed(clone, tokenOf(await readClone(clone)));
  };

/** What a run remembers of the directories it saw, as it goes. */
interface Memory {
  remembered: RememberedResolutions;
}

/** Looks at each directory once: what it saw is kept, and what it learned goes to `memory`. */
function lookingAtDirectories(machine: ResolutionMachine, memory: Memory) {
  const directories = new Map<string, Directory>();
  const { environment } = machine;
  const look = async (cwd: string): Promise<Directory> => {
    const dir = cwdKey(cwd, environment.caseInsensitiveFileSystem);
    const at = () => environment.now().toISOString();
    const looked = directoryFrom(await machine.locate(cwd), { dir, at }, memory.remembered);
    memory.remembered = looked.remembered;
    return looked.directory;
  };
  return async (cwd: string): Promise<Directory> => {
    const held = directories.get(cwd);
    if (held !== undefined) return held;
    const directory = await look(cwd);
    directories.set(cwd, directory);
    return directory;
  };
}

/** Starts a run: it looks at each directory once, and keeps what it learns. */
export function startResolutionRun(
  start: ResolutionStart,
  machine: ResolutionMachine
): ResolutionRun {
  const { consents } = start;
  const { environment } = machine;
  const memory: Memory = { remembered: start.remembered };
  const directoryOf = lookingAtDirectories(machine, memory);
  const closed = closedIntervalOf(consents, machine.readClone);
  const state = (): ResolutionState => ({
    remembered: memory.remembered,
    consents,
    unreadable: start.unreadable,
    caseInsensitiveFileSystem: environment.caseInsensitiveFileSystem,
  });
  return {
    get learned() {
      return memory.remembered;
    },
    get coveredFrom() {
      return consents.damaged ? Number.NEGATIVE_INFINITY : consents.firstOpened();
    },
    get now() {
      return environment.now().toISOString();
    },
    get consentLogDamaged() {
      return consents.damaged;
    },
    async resolve(cwd, at) {
      // A consent log that cannot be read says nothing for any clone.
      if (consents.damaged) return unreadableAt(state(), cwd, at);
      return verdictOn(await directoryOf(cwd), { cwd, at, closed }, state());
    },
  };
}

export type StartResolutionRun = (start: ResolutionStart) => ResolutionRun;

/** Runs bound to the machine: the directories it locates, its clones' keys, its clock. */
export function resolutionRunOf(
  locator: RepositoryLocator,
  consentSource: ConsentSource,
  environment: ResolutionEnvironment
): StartResolutionRun {
  return (start) =>
    startResolutionRun(start, {
      locate: (cwd) => locator.locate(cwd),
      readClone: (clone) => consentSource.readClone(clone),
      environment,
    });
}
