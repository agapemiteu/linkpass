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
- Verify deployment on team06, register the webhook, then run A/B/C/D against the real sandbox.
- Confirm which Huawei model IDs are enabled; vision is optional.

## Open decisions
- Should `linkpass.log` be committed? Currently git-ignored, along with CLAUDE.md.
