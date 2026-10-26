---
status: done
---

# Instruction: The identity rule (M7)

```txt
cli/src/contexts/telemetry/domain/
├── repository-identity.ts                 ✏️ host folded on every form, ssh.github.com, github.com path folded
└── legacy/legacy-repository-identity.ts   🆕 the earlier rule, frozen, for the migration only
cli/tests/contexts/telemetry/domain/
├── repository-identity.unit.test.ts       ✏️ every form of one repository, one address
└── legacy/legacy-repository-identity.unit.test.ts 🆕 the earlier rule pinned
```

| Case | Proof |
| --- | --- |
| https, ssh://, git://, git+ssh://, scp-like, userinfo, port, `.git`, trailing `/`, case: one address on `github.com` | unit table |
| another host keeps owner and repo case | unit |
| `ssh.github.com:443` is `github.com` | unit |
| the earlier rule gives what cli-v5.5.0 gave | unit, pinned hashes |
