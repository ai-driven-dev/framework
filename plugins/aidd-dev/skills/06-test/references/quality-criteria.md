# Test quality criteria
What a passing test meets before it counts as done, whatever the language.

## Terms
| Term | Meaning |
| --- | --- |
| Convention | a documented rule or the project's test configuration, never a pattern found in existing tests |
| Stub | a double that feeds the subject data; a call that only fetches data is a stub's, whatever the double is called |
| Mock | a double whose call changes something outside the subject, such as sending a message, writing a record or emitting an event |

## Criteria
| Criterion | Rule |
| --- | --- |
| Observable behavior | Assert what a caller or user can observe: a returned value, a state change, an output, an error, or an outgoing command as Stub queries, mock commands defines it. A test that checks only internal structure, calls to a stub, or which collaborators were called without the values the subject computed is not done. |
| Real subject | The behavior under test runs for real. Never replace its own logic with a double; the boundaries it crosses follow Doubles at seams. |
| Doubles at seams | For each dependency of the subject, take the first case below that applies. |
| Stub queries, mock commands | Never assert on a stub. Asserting a mock's call, with the values the subject computed, is the behavior, and the test's name says so. |
| No tautology | Reject a test that passes whatever the subject does, such as one whose expected value only echoes what a stub was configured to return. |
| Effectiveness | Name the break that would defeat the intended behavior, such as a removed branch, an inverted condition, or an input returned unchanged. The break keeps the subject running and targets the behavior's own logic; deleting the subject or making it throw does not count. A test no break can fail protects nothing: strengthen it. Use mutation testing only when the project already configures it. |

## Doubles at seams
1. It is the behavior under test: never double it.
2. The subject sends it a command whose call is the behavior: mock it for that call only, where the test can substitute it without patching the subject.
3. It crosses a boundary (network, filesystem, clock, randomness, a third-party service) through a seam: a seam the project defines such as a port, a module whose sole job is that boundary, or the test framework's own interception of it such as fake timers. Double it at that seam, or use an isolated real resource that exposes the effect, such as a temporary directory or an in-memory store.
4. It receives such a command or crosses such a boundary, but no seam lets the test substitute it and no isolated real resource exposes the effect: never patch the subject. Show the behavior to the user with its score and `missing seam at <dependency>`; once they agree, it becomes `pending` with that reason and the design change is left to its owner.
5. Anything else, including a collaborator carrying domain logic: use the real one.

## Effectiveness check
| Score | Check |
| --- | --- |
| 4 or 5 | `run`: copy the files the break touches, apply it and watch the test fail, restore them, confirm they match the copy, then rerun and watch the test pass |
| below 4 | `run`, or `reasoned`: state why the test fails under the break |
