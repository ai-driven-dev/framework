# Cases

The steps of [write](../actions/02-write.md) each case runs, in their numbered order.

| Case | When | Steps |
| --- | --- | --- |
| from scratch | no `aidd_docs/ui/system.md`, no UI code | 3, 6, 7, 8, 9 |
| from the code | no `aidd_docs/ui/system.md`, UI code exists | 2, 3, 4, 7, 8, 9 |
| new elements | `system.md` exists, the request adds tokens or elements | 6 if tokens are new, 7, 8, 9 |
| change | `system.md` exists, the request changes or removes a token or an element | 5, 6 if a token changes, 7 for the renders whose markup changes, 8 |
