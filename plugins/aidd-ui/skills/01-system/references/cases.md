# Cases

The steps of [write](../actions/02-write.md) each case runs, in this order.

| Case | When | Steps |
| --- | --- | --- |
| from scratch | no `aidd_docs/ui/system.md`, no UI code | 3, 5, 6, 7, 9 |
| from the code | no `aidd_docs/ui/system.md`, UI code exists | 2, 3, 4, 6, 7, 9 |
| new elements | `system.md` exists, the request adds tokens or elements | 5 if tokens are new, 6, 7, 9 |
| change | `system.md` exists, the request changes or removes a token or an element | 8, then 5 if a token changes, then 6 for the renders whose markup changes, 7 |
