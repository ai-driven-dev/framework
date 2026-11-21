---
status: historical-in-progress-current-partially-superseded
---

# Phase 6: Generation and runtime evidence

Historical instruction: [related historical runtime-test commit](https://github.com/ai-driven-dev/framework/commit/7a2d5d2192dfd9a0784509c15b1ddf87e81bbe42). Historical status: `in-progress`. Current scope status: partially superseded by native Kilo E2E and platform CI; broader `skill-eval` extensions and real-LLM generation proof were removed from this PR.

## Architecture projection

The historical phase proposed both a wider skill-evaluation runner and Kilo runtime tests. The current PR retains the focused native runtime path in `cli/tests/e2e/kilo-native-generation.e2e.test.ts`, its local scripted provider helper, and the CI invocation. It contains no broad `skill-eval` host extension.

## Test Scope

The current E2E has separate scenarios: a skill assembled by the test is discovered and used with a deterministic local provider; a workflow authored inside the test is invoked; checked-in skill/rule/agent/workflow fixtures are copied into a project and inspected through Kilo debug/config commands. That fixture scenario reads project memory, not the rule body, and does not invoke the agent or saved workflow. Platform CI passed on Windows, Linux, and macOS Intel. None of these scenarios is a real LLM generating each artifact through the AIDD workflows.

## Tasks to do

- Historical: planned generated-output provenance, negative cases, platform evidence, and broader evaluation. The archive reports the phase as incomplete.
- Current: the Kilo runtime and CI subset is delivered. The wider `skill-eval` work is out of scope. Do not treat the current E2E as proof of all historical phase-6 acceptance criteria.

## Test acceptance criteria

| Criterion | Current evidence/status |
| --- | --- |
| Kilo discovers and uses a native skill in runtime. | Covered for a test-authored skill with positive/negative cases and scripted provider; not generator output provenance. |
| Kilo invokes a native workflow in runtime. | Covered for a workflow authored inside the test; saved AIDD workflow fixture is inspected, not invoked. |
| Kilo reads the saved rule and invokes the saved agent. | Not demonstrated by current CI; the rule path/agent configuration are inspected only. |
| Runtime has positive/negative cases and deterministic provider behavior. | Covered in the native skill scenario; the provider is scripted and does not provide external model reasoning. |
| A genuine LLM invocation generated each runtime artifact. | Not established by current CI. |
| Cross-host `skill-eval` extensions are delivered. | Removed from the revised PR scope. |
| Phase 6 completed as originally planned. | No; historical status remains `in-progress`. |
