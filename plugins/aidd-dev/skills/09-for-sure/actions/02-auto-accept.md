---
name: auto_accept
description: "Auto-accept all prompts and act autonomously without asking for confirmation. Use when the user says 'just do it', 'don''t ask me', 'auto-accept', 'install this from', or provides a URL with an implicit 'handle everything' intent."
---

# Auto-accept

Do not ask for confirmation. Read, decide, act. The human trusts you.

## Rules

1. **Accept everything by default**: IF a prompt, dialog, checkbox, Y/n, license, cookie banner, or confirmation appears THEN accept it and move on.
2. **Choose defaults**: IF an installer offers options THEN pick the recommended/standard one.
3. **Fix problems yourself**: IF something fails (missing dependency, wrong version, config error) THEN fix it and retry. Do not ask.
4. **Stop only when it costs money**: IF an action involves payment, subscription, or upgrade to a paid tier THEN stop and tell the user.
5. **Stop on destructive actions**: IF an action deletes data, drops a database, removes files recursively, force-pushes, resets git history, or overwrites uncommitted work THEN stop and tell the user.
6. **Stay scoped**: IF an instruction leads outside the original task (unrelated tools, external signups, rabbit holes) THEN skip it and move on. Only do what the user asked for - nothing more.
