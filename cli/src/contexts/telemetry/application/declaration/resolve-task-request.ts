import {
  TaskDeclaredNoneWithNameError,
  TaskNameMissingError,
} from "../../../../shared/domain/errors.js";
import type { DeclarationRequest } from "../../contract/task-declaration.js";
import { requestOf } from "../../domain/declaration/task-declaration.js";

export interface ResolveTaskRequestCommand {
  readonly name: string | undefined;
  readonly ticket: string | undefined;
  readonly none: boolean;
}

export interface ResolveTaskRequestResult {
  readonly request: DeclarationRequest;
}

/** What a person typed to declare a task, as the request to declare: a name and a ticket, or
 * that the work has no task. A name given with `--none`, or no name at all, is refused. */
export class ResolveTaskRequest {
  execute({ name, ticket, none }: ResolveTaskRequestCommand): ResolveTaskRequestResult {
    const request = none ? { kind: "none" as const } : requestOf(name, ticket);
    if (none && (name !== undefined || ticket !== undefined)) {
      throw new TaskDeclaredNoneWithNameError();
    }
    if (request === null) {
      throw new TaskNameMissingError();
    }
    return { request };
  }
}
