# LinkPass

Safe spending for every child. Their freedom. Your rules.

**Try the preview:** https://linkpass-iota.vercel.app (mock bank; the live demo runs on the Access Forge sandbox)

A child pastes a product link. LinkPass matches it to a confirmed offer from a registered seller and checks it against the parent's rules. If every rule passes, it pays from a pre-funded allowance by bank transfer. If not, the request goes to the parent. Built for Access Youth Tech Forge 2026 (Payments and Financial Infrastructure) on the Xtradot Bank sandbox and Huawei MaaS.

## How money moves

| Case | Route | Marked paid when |
|---|---|---|
| Inside the rules | Intrabank transfer from the controlled source account to the seller's registered settlement account | `/transfers/intra` or a requery of `GET /transfers/{ref}` returns `successful` |
| Parent approves, pays at checkout | `POST /payments/checkout` to the seller's Forge merchant ID | `GET /payments/{ref}/verify` returns `successful` with the full amount |
| Parent approves from the allowance | Same as the first row, bound to that exact purchase | Same as the first row |

- The policy engine (`src/lib/policies/evaluator.ts`) is plain code. AI output never authorizes a payment.
- Every amount is integer kobo. The allowance lives in an append-only double-entry ledger (`src/lib/finance/ledger.ts`): fund, reserve, settle, release, reverse.
- Execution reserves the funds and claims a single payment attempt in one SQLite transaction. Two taps or two concurrent purchases can't double-spend.
- On a timeout or 5xx the payment stays pending and the funds stay reserved. The app requeries the original reference and never resends.
- The seller's bank account is fingerprinted when the parent approves the seller. If the account changes, the purchase is blocked. The name enquiry must also return the registered holder.
- Webhooks are verified with HMAC over `{timestamp}.{raw_body}`, rejected after 5 minutes and de-duplicated on `event_id`. A webhook only triggers a status check with the bank.
- Links are parsed, never fetched (no SSRF). Seller text is treated as untrusted data in the prompt.

## Demo limitations (stated plainly)

- The controlled source is a team-owned sandbox account (`0123456789`), not an Access custodial or safeguarding account. An allowance is credited only after a live balance check confirms the account backs every outstanding allowance.
- The sandbox maps merchant `mer_206` to account `0123456790`, whose holder is "Babatunde Olumide Adeyemi". The fixture doesn't prove the holder and the store are the same entity. The seller-to-account binding is a seeded test record.
- Logins use Demo Mode with two seeded users. Production would need real guardian authentication, KYC and the bank's approval of the custody model.

## Run locally

```bash
npm install
BANK_PROVIDER=mock npm run dev   # MOCK bank, clearly labelled in the UI
npx vitest run
```

The real bank and Huawei gateways only answer from inside the team namespace.

## Deploy (team06)

Pushing to `main` runs the tests and pushes `ghcr.io/agapemiteu/linkpass:<sha>`. Then:

```bash
export KUBECONFIG=~/forge/team06.yaml
sed "s/IMAGE_TAG/<sha>/" k8s/app.yaml | kubectl apply -f -
kubectl rollout status deployment/app
```

Open `/demo` as the parent and choose **Register bank webhook** once per sandbox reset.
