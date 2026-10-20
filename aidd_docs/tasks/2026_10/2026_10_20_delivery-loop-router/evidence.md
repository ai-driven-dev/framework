# Router reading cost

Count physical lines, including blank lines. The measured path reads `SKILL.md`, `references/routing.md`, the selected mode sequence and all action files in that sequence. After the change it also reads `actions/route.md`. Setup templates and conditional references are excluded from both sides. The baseline is the merge base of the feature branch and `origin/next`, so the command remains valid after commits. Fetch `origin/next` before running it.

| Mode | Before | After | Change |
| --- | ---: | ---: | ---: |
| Setup | 796 | 751 | -45 |
| Run | 508 | 453 | -55 |
| Review | 424 | 365 | -59 |

Shortest: review, 424 → 365 lines. Longest: setup, 796 → 751 lines.

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
