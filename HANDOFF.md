# LinkPass: Handoff and Working PRD

Read this first. It covers what LinkPass is, what's built and where everything runs, plus what's left to do and what must not change.

## 1. Product in one paragraph

LinkPass lets teenagers (13–17) buy things they find on Instagram, TikTok or WhatsApp, inside rules their parent set once. The child pastes a link. Huawei AI identifies the product, and LinkPass matches it to a **verified seller's confirmed offer**. A **deterministic rules engine** (plain code, never AI) checks seller, category, per-item limit, daily limit, expiry and funds. Inside the rules, the purchase is paid from a pre-funded allowance by a real **Access (Xtradot) sandbox bank transfer**, with no parent tap. Outside the rules, the parent approves, then pays at the bank's hosted checkout or approves it from the allowance. Lookalike sellers are blocked. Nothing shows as "Paid" until the bank confirms it.

Tagline: **Safe spending for every child.** Supporting line: **Their freedom. Your rules.**

Hackathon: Access Youth Tech Forge 2026, Payments and Financial Infrastructure track. Team Pak, **team06**.

## 2. Ground rules (from the owner)

- Never add Claude/AI as a collaborator, co-author or contributor. **No `Co-Authored-By` lines in commits.**
- No AI slop. Keep things simple and clear; don't overbuild.
- Log each session to `linkpass.log` (project root, git-ignored) and keep `CONTEXT.md` current.
- The repo is **public**. Never commit secrets (`docs/` is git-ignored; it holds the kubeconfig, the R2 keys and the organizer PDFs).

## 3. Where things live

| Thing | Location |
|---|---|
| Code | github.com/agapemiteu/linkpass (`main`) |
| Live sandbox app (real bank + AI) | Kubernetes namespace `team06`, Deployment `app`, Service `app` port 80 → 8080 |
| Public URL | https://team06.xtradot.co (organizers keep it behind a Cloudflare login until demo day) |
| View it now | `KUBECONFIG=docs/team06.yml kubectl port-forward svc/app 8080:80`, then open http://localhost:8080 |
| Container image | `ghcr.io/agapemiteu/linkpass:<git sha>` (public), built by GitHub Actions on every push to `main` |
| Database (cluster) | SQLite at `/data/linkpass.db` on emptyDir, streamed to **Cloudflare R2** bucket `linkpass-db` by Litestream and restored on start. Secret `linkpass-r2` (keys in `docs/r2.env`) |
| Preview (share link) | Vercel project `linkpass`, https://linkpass-iota.vercel.app. Uses the **mock bank** (it can't reach the sandbox) and a Turso database (`database-charcoal-bell`, via the Vercel Marketplace) |
| Pitch deck | `docs/LinkPass_Pitch_Deck.pptx` (local only; replace `TEAM_MEMBERS` on slide 1) |
| Organizer docs | `docs/` (platform guide and API spec PDFs, plus `guide.txt` and `api-spec.txt` extracts) |
| kubectl | `~/bin/kubectl.exe` on the owner's PC |

## 4. Status

**Done and verified live on the sandbox**
- Scenario A: ₦15k sneakers, approved automatically, real intrabank transfer, `PAID`. A second tap is rejected.
- Scenario B: ₦35k sneakers, needs the parent, approved, hosted checkout paid with the test card, `verify` = successful, `PAID`.
- Scenario C: lookalike `@osun.threadz`, `BLOCKED`, no transfer. The app then offers the same item from a verified seller (`findSaferAlternatives`, exact item only, ranked by seller track record in `src/lib/merchants/trust.ts`, simulated web check for the demo).
- Scenario D: forced timeout, `PAYMENT_PENDING`, funds held, bank reversal, funds released. Never resent.
- Huawei `glm-5.2` product extraction works (~8 s). Without AI it falls back to matching from the link.
- 32 unit tests (policy, ledger, concurrency, timeout/reversal, webhook signature, SSRF/lookalike).
- Journey UI: photo story welcome page, colourful child "pass", path timeline, confetti, parent dashboard.

**In progress**
- The Vercel preview needs the async DB layer + Turso deployed. The code is written (`src/lib/db/index.ts`) and all 32 tests pass on local SQLite. Still to do: run against Turso (`vercel env pull`, then test), commit, push (Vercel auto-deploys), then smoke-test that a purchase survives across requests.
- The cluster runs the **pre-async** image (commit with "CA certificates"). Only redeploy the cluster after the async build is tested; that version works on SQLite too.

**Platform caveats**
- The cluster control server has intermittent TLS timeouts (an organizer-confirmed platform issue). Retry kubectl; the app keeps running.
- Quota can over-count replaced pods. Deploy sparingly (`kubectl set image`, one rollout).

## 5. Demo-day checklist (sandbox)

1. `kubectl get pods`: one `app` pod, `1/1 Running`.
2. Open the public URL (or the port-forward). Choose **Adaeze**, then **Demo tools** → **Register bank webhook** (once after any sandbox reset).
3. Adaeze → **Add money** ₦50,000. This is credited only after a live balance check of account `0123456789`.
4. Five-minute demo: Adaeze's rules → Mira pastes **Canvas sneakers** → paid with no parent tap → **Red sneakers** → Ask parent → Adaeze approves → checkout (card `5399 8300 0000 0008`, CVV 123, PIN 1234, OTP 123456) → **Lookalike shop**, blocked.
5. Optional: Demo tools → force **timeout** → buy the **Adire tee** → shows pending, then the bank resolves it.

## 6. Architecture

- Next.js 15 App Router, TypeScript, Tailwind, Hugeicons, motion. Server-only bank and AI calls.
- `src/lib/policies/evaluator.ts`: deterministic rules. Hard blocks: unverified seller, beneficiary mismatch, unconfirmed offer, prohibited category. Parent-overridable: seller not approved, category, single limit, daily limit, allowance.
- `src/lib/purchases.ts`: create, request approval, decide, `executeTransfer` (atomic reserve + single attempt, name enquiry must match the registered holder, send once, requery on unknown), `finalize` (idempotent, handles reversal), `startCheckout`, `refresh` (verify-before-paid), `fundAllowance` (balance-backed), `savePolicy` (versioned, immutable).
- `src/lib/finance/ledger.ts`: append-only double-entry ledger in integer kobo: FUND / RESERVE / SETTLE / RELEASE / REVERSE.
- `src/lib/db/index.ts`: async `Db` interface. Local SQLite (process lock serialises transactions) or Turso (`TURSO_DATABASE_URL`).
- `src/lib/bank/forge-client.ts`: Xtradot API (envelope, Idempotency-Key, `x-test-outcome`). `mock-client.ts`: labelled mock for local/Vercel.
- `src/lib/ai/extraction.ts`: Huawei MaaS (OpenAI-compatible, `apikey` header, thinking off), zod-validated, cached; post text is treated as untrusted data.
- `src/app/api/webhooks/forge`: HMAC verify, 5-minute window, dedupe on `event_id`, then requery the bank (never trusts the payload).
- Env (cluster): `BANK_PROVIDER=forge`, `GATEWAY_KEY` (secret `huawei-gateway`), `TEAM_ID=team06`, `APP_BASE_URL`, `DEMO_MODE=true`, R2 vars from secret `linkpass-r2`.

## 7. Seed data

- Users: guardian `Adaeze` (`guardian_001`), child `Mira` (`child_001`), family `family_001`.
- Sellers: `mer_206` Ọ̀ṣun Threads (verified, settles to `0123456790`), `mer_204` Mama Nkechi (verified, not approved), `unv_001` Osun Threadz (impersonator, pays `0123987001`).
- Policy v1: ₦20k per item, ₦40k a day, Ọ̀ṣun Threads only, clothing + footwear, 30 days.
- Demo links: `instagram.com/osunthreads/p/canvas-sneakers` (₦15k), `/leather-hightops` (₦35k), `/adire-tee` (₦6k), `instagram.com/osun.threadz/p/canvas-sneakers` (lookalike).

## 8. Known limitations (say them honestly)

- The controlled source is a team sandbox account, not an Access custody account. Production needs Access to approve the custody, KYC and safeguarding model.
- The `mer_206` → `0123456790` holder name comes from the fixture. The seller-to-account binding is a seeded test record.
- Logins are Demo Mode with two seeded users.

## 9. Commands

```bash
npm install && npx vitest run              # tests
BANK_PROVIDER=mock npm run dev            # local, mock bank
git push                                  # CI builds ghcr.io/agapemiteu/linkpass:<sha>; Vercel auto-deploys
KUBECONFIG=docs/team06.yml kubectl set image deployment/app app=ghcr.io/agapemiteu/linkpass:<sha>
KUBECONFIG=docs/team06.yml kubectl rollout status deployment/app
KUBECONFIG=docs/team06.yml kubectl logs deploy/app --tail=30
```
