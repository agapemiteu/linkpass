# LinkPass — Context

## Status
- 2026-11-10: Ground rules set. PRD received; docs moved to `docs/` (git-ignored: public repo, kubeconfig inside).
- 2026-11-10: MVP built: Next.js 15 + SQLite (better-sqlite3), deterministic policy engine, double-entry allowance ledger, Forge adapter (intra transfer, checkout, verify, balance, webhooks), mock adapter, Huawei extraction with link-only fallback. 32 unit tests pass. Scenarios A/B/C verified locally against the mock bank.
- CI (GitHub Actions) tests and pushes `ghcr.io/agapemiteu/linkpass:<sha>`. Deploy with `k8s/app.yaml`.

## Key decisions
- Pre-funded source = team account 0123456789 (Adaeze). Approved seller = mer_206 Ọ̀ṣun Threads → settlement 0123456790 (intrabank, no fee).
- Allowance credited only after a live bank balance check backs all outstanding allowances.
- Impersonator = `@osun.threadz`, an unverified record paying to 0123987001 → BLOCKED.
- Pending/timeout demo: /demo sets a one-shot `x-test-outcome` for the next transfer.
- Links are never fetched (SSRF); the AI only reads URL text, the description and the screenshot.

## Next
- Deployed to team06 (image 0c908f6). Live sandbox verified: A paid by real intra transfer, C blocked, D timeout held then reversed + released, B paid via real checkout + verify. Huawei glm-5.2 extraction works.
- Storage: SQLite on emptyDir, streamed to Cloudflare R2 by Litestream (restores on start). Secret linkpass-r2 (keys in docs/r2.env, git-ignored).
- Not yet run live: screenshot/vision model, webhook delivery observed end to end.

## Open decisions
- Should `linkpass.log` be committed? Currently git-ignored, along with CLAUDE.md.
