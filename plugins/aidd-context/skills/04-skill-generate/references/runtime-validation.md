# Runtime trial

| Part | Required detail |
| --- | --- |
| Proposal | A concrete scenario: the inputs, the actions to execute, and the expected outcome of each action, put to the user as a question |
| Boundary | An isolated workspace, allowed writes, external calls or other effects, and cleanup; the trial agent delegates no further work |
| Approval | The user's decision on that specific proposal; silence does not approve it |
| Subagent brief | The generated skill's path, approved scenario and boundaries, and access needed to run it |
| Execution | Read the generated skill and execute its actions on real inputs; compare observed outcomes with the agreed checks |
| Evidence | Actions exercised, commands or tool calls, observed results, artifact paths, and any unexercised branch |
| Outcome | Passed only when every agreed check was exercised and met; otherwise failed or unverified, with the gap |
