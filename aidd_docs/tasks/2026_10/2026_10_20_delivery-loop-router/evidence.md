# Router reading cost

Count physical lines, including blank lines. The measured path reads `SKILL.md`, `references/routing.md`, the selected mode sequence and all action files in that sequence. After the change it also reads `actions/route.md`. Setup templates and conditional references are excluded from both sides. The baseline is the merge base of the feature branch and `origin/next`, so the command remains valid after commits. Fetch `origin/next` before running it.

| Mode | Before | After | Change |
| --- | ---: | ---: | ---: |
| Setup | 796 | 750 | -46 |
| Run | 508 | 452 | -56 |
| Review | 424 | 364 | -60 |

Shortest: review, 424 → 364 lines. Longest: setup, 796 → 750 lines.

Reproduce from the repository root:

```python
from pathlib import Path
import subprocess
base = 'plugins/aidd-orchestrator/skills/00-async-dev/'
subprocess.run(['git', 'fetch', 'origin', 'next'], check=True)
baseline = subprocess.check_output(['git', 'merge-base', 'origin/next', 'HEAD'], text=True).strip()
old = lambda path: len(subprocess.check_output(['git', 'show', f'{baseline}:{base}{path}']).splitlines())
new = lambda path: len((Path(base) / path).read_bytes().splitlines())
for mode in ('setup', 'run', 'review'):
    actions = [str(path.relative_to(Path(base))) for path in sorted((Path(base) / 'actions' / mode).glob('*.md'))]
    before = old('SKILL.md') + old('references/routing.md') + sum(old(path) for path in actions)
    after = sum(new(path) for path in ['SKILL.md', 'actions/route.md', 'references/routing.md', f'actions/{mode}.md', *actions])
    print(mode, before, after, after - before)
```

# Routing parity scenarios

Compared the pre-change `SKILL.md` and `references/routing.md` at the merge base with the new `actions/route.md` and `references/routing.md`. These are **documented decision outcomes**, not executions by a skill host. The scenarios cover the named signals and the exceptions to ordinary precedence.

| Signal | Concrete input | Baseline decision | New decision |
| --- | --- | --- | --- |
| Explicit argument | Arguments exactly `RUN` | run | run |
| Explicit action | Prompt `action=review on PR #17` | review | review |
| CI label | `GITHUB_EVENT_NAME=issues`, label `to-implement` | run | run |
| CI label | `GITHUB_EVENT_NAME=issues`, label `to-review` | review | review |
| CI comment alias | `issue_comment`, `@claude /aidd-dev:02-implement` | run | run |
| CI comment alias | `issue_comment`, `@claude /aidd-dev:05-review` | review | review |
| CI dispatch | `workflow_dispatch`, input `action=setup` | setup | setup |
| Repository state | Workflow and config both absent | setup | setup |
| Repository state | Workflow present, config absent | setup | setup |
| Repository state | Open PR closes referenced issue | review | review |
| Repository state | Fresh issue, no linked PR, implementation intent | run | run |
| Natural language | `bootstrap async dev` | setup | setup |
| Natural language | `pick up the queue` | run | run |
| Natural language | `apply feedback` | review | review |
| Tie break | `action=review` and label `to-implement` | review | review |
| Blocking conflict | User requests run, config absent | stop, request setup | stop, request setup |
| Resolved conflict | Webhook `to-implement`, open closing PR | review, comment | review, comment |
| Resolved conflict | Both `to-implement` and `to-review` labels | review, comment | review, comment |
| Unresolved | No matching arguments, trigger, state, or intent | ask which mode | ask which mode |

The original root described a standalone mode token inside arguments as an override, while the original routing reference required arguments to equal a mode or the prompt to contain `action=<mode>`. The new reference follows the explicit argument contract used by CI: exact mode arguments or a standalone `action=<mode>` token. Plain mode words in a longer prompt remain natural-language signals. Runtime LLM selection and mode execution remain unverified; the static tests below guard the written contract and action boundaries.
