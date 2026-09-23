# DNAAnalyzer production preparation

> **Payment deployment is paused.** For the current authenticated, free-access
> release, follow `FREE_DEPLOYMENT.md`. The Paddle sections below are retained
> only for a possible future billing launch and must not be used now.

Status: **local preparation only; not ready for real payments**.

No deployment, hosted database mutation, new purchase, or live-payment activation is part of this work. Existing `.env.local`, migrations, credentials and sandbox entitlements stay unchanged.

## Owner decisions

| Item | Confirmed choice / outstanding decision |
| --- | --- |
| Seller | Aawaiz Azhar Spall |
| Support email | aawaizazhar26@gmail.com |
| Production domain | Undecided |
| Refund policy | Undecided: eligibility, deadline, exclusions, refund effects on access |
| Retention | Owner requested “Forever”: no scheduled expiry of account data and saved inputs/results; not a guarantee of permanent availability |
| Deletion | Awaiting confirmation of email-request procedure |
| Backups and billing records | Retention, exceptions and deletion workflow need confirmation |
| Policy publication | Drafts only; effective date and final review not set |

The owner-facing configuration is `src/lib/public-site.ts`. Do not replace missing values with invented names, domains, deadlines or guarantees. Filling in a policy is not the same as implementing its operational requirements.

## Existing architecture and payment flow

- `src/app/page.tsx`: current analysis workspace, retained at `/`.
- Next.js App Router hosts UI and API routes; Supabase provides authentication, profile/history storage, billing state, caches and quota enforcement.
- Modal endpoints execute Evo2 and disease-model inference. UCSC and NCBI/NLM services supply genome/reference information.
- `src/lib/plans.ts`: Student = 5 predictions/day, hg38, no history access/export/disease ranking; Researcher = 50/day, all available assemblies, history, CSV and eligible disease ranking. “All” does not promise unsupported assemblies or model inputs.
- `src/lib/disease-ranking-policy.ts`: benign/likely benign skips automatic rankings; VUS skips by default and requires explicit exploratory opt-in; pathogenic predictions still yield research hypotheses, not clinical diagnoses.
- `POST /api/billing/checkout`: authenticates user/origin, validates the catalog, reserves an attempt, creates or resumes a server-owned transaction.
- `/billing/checkout`: opens Paddle checkout by transaction ID. The backend uses Paddle's configured default payment link.
- `POST /api/billing/webhook`: validates the raw-body signature, fetches current provider entities and atomically applies billing state with event deduplication.
- `GET /api/billing/status`: reports eligibility and configured price. `POST` reconciles with Paddle; manual refresh is rate limited and currently scans one provider page.
- `/billing/success`: polls local billing state; the browser completion event cannot grant access.
- `POST /api/billing/portal`: creates a customer portal session for the authenticated customer.
- Researcher eligibility depends on verified subscription status, the configured price/product, eligible items and an unexpired billing period. Cancellations and refunds are separate actions.

## Completed in this preparation

- [x] Public `/product`, `/pricing`, `/contact`, `/terms`, `/privacy`, `/refunds` routes, with shared navigation/footer.
- [x] Existing analysis root, account pages and billing flows preserved.
- [x] Sidebar link makes product/pricing/policies discoverable from the application.
- [x] Public pages use the existing theme, typography and responsive layout conventions; no new UI dependencies.
- [x] Plan comparison reads the existing plan constants.
- [x] Researcher price is read server-side from the configured Paddle catalog with a five-second timeout and 60-second cache, never hardcoded as a production offer.
- [x] Catalog errors show “Price temporarily unavailable”; sandbox prices explicitly indicate no real charges.
- [x] Public pages do not create checkout transactions or expose API credentials.
- [x] Research limitations and classification-specific ranking rules explained.
- [x] Seller/contact values reflect the owner's response.
- [x] Terms/Privacy/Refunds visibly marked as drafts; all public-preview pages use `noindex, nofollow`.
- [x] Indefinite retention disclosed as an owner preference without inventing backup or deletion commitments.
- [x] No fabricated clinical validation, refund guarantee, privacy certification or legal jurisdiction.

## 1. Review locally

In PowerShell, run each command separately:

```powershell
Set-Location "C:\Users\Aawaiz\Desktop\variant-analysis-evo2\evo2-frontend"
npx next dev --turbo --port 3000
```

If port 3000 already serves the app, use that process or stop it with Ctrl+C first. Do not terminate unrelated processes.

Open these in a private browser window:

```text
http://localhost:3000/product
http://localhost:3000/pricing
http://localhost:3000/contact
http://localhost:3000/terms
http://localhost:3000/privacy
http://localhost:3000/refunds
```

- Check all pages without signing in, then while signed in.
- Check keyboard navigation, skip link, visible focus, mobile width and light/dark theme.
- Confirm the email link opens a draft addressed to the supplied support email.
- Confirm pricing is labeled sandbox and matches Paddle; disconnect the price service to verify its fallback if needed in a mocked test environment.
- Ensure public navigation returns to `/` and the analysis workspace is unchanged.
- The public shell omits the application sidebar, but still inherits the existing session/theme providers. Valid Supabase environment configuration is required.

## 2. Finalize the owner details

- [ ] Choose a domain and confirm control of it.
- [ ] Choose refund eligibility, deadline, exclusions and access treatment after refund.
- [ ] Confirm the manual deletion request channel, verification procedure and handling of shared caches.
- [ ] Specify backup expiry, logging retention and billing-record exceptions.
- [ ] Review whether indefinite retention fits the actual data collected and applicable requirements; implement any required deletion rights.
- [ ] Write the support runbook. There is no self-service account/analysis deletion workflow added by this change.
- [ ] Review Terms for eligibility, jurisdiction, IP, permitted use, service changes and liability; no legal choices are supplied automatically.

Once agreed, update `src/lib/public-site.ts` and the page text together. Implement policy promises before setting `policiesApproved` to true. Remove draft headings/metadata only after review. The boolean alone does not finalize page text or activate payments.

## 3. Obtain Paddle eligibility and live approval

Describe the real genetic-analysis and ranking features to Paddle. Its product rules prohibit medical advice; a research disclaimer alone is not approval.

Suggested support message:

```text
I am Aawaiz Azhar Spall, an individual developer based in Pakistan without an incorporated company.

DNAAnalyzer analyzes genetic variants using Evo2 and presents disease-association research hypotheses. Paid access adds analysis capacity, saved-history access and CSV exports.

Please confirm eligibility of this actual product, individual onboarding requirements for Pakistan, required identity/tax/payout information, and whether a single owner-card purchase is permitted after live approval.

I can provide the public website and a demonstration.
```

- [ ] Product accepted by Paddle.
- [ ] Seller identity and payout arrangements approved.
- [ ] Website review completed for the exact production checkout hostname.

References: [Paddle domain review](https://www.paddle.com/help/start/account-verification/what-is-domain-verification), [acceptable product categories](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle), [individual account verification](https://www.paddle.com/help/start/account-verification/what-is-account-verification).

## 4. Deploy staging using sandbox, after separate authorization

Suggested Next.js host settings:

| Field | Value |
| --- | --- |
| Root directory | `evo2-frontend` |
| Framework | Next.js |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | Framework default |
| Start command, for a Node server host | `npm run start` |

Use a commercially permitted hosting plan for the paid application. Pin and validate a supported Node version against the installed Next.js and Paddle SDK before deployment (current Paddle SDK requires Node 20+).

Keep staging on the current sandbox configuration. Set `NEXT_PUBLIC_APP_URL` to its exact HTTPS origin. In Supabase, add the staging login redirect. Configure a stable webhook URL ending `/api/billing/webhook`; do not require hosting login for that endpoint. Keep signature verification enabled.

The public website pages are implemented, not deployed. No domain ownership or hosting account is assumed.

## 5. Verify webhooks before real billing

- [ ] New sandbox purchase activates Researcher without pressing Refresh status.
- [ ] Closing the browser after payment still results in an upgrade.
- [ ] Paddle destination logs show successful delivery.
- [ ] Provider events, not only reconciliation records, exist in the database.

Run this read-only query in the sandbox Supabase SQL Editor:

```sql
SELECT event_id, event_type, processed_at
FROM public.billing_events
WHERE environment = 'sandbox' AND event_id LIKE 'evt_%'
ORDER BY processed_at DESC
LIMIT 20;
```

Use actual sandbox entities: invented simulator IDs cannot pass authoritative provider lookup. The current handler fetches Paddle entities synchronously. Measure response time; add durable ingestion/background processing if it cannot reliably meet the provider delivery deadline. Add monitored background reconciliation with pagination before expanding beyond the initial setup.

Use the complete event list and test-card scenarios in `BILLING_SETUP.md`. Test renewals, decline/recovery, scheduled/immediate cancellation, pause, refunds, duplicated/late events, rejected signatures and database failures. Refunds currently record adjustments without automatically canceling a subscription.

## 6. Prepare a separate production database and catalog

Do not convert the existing sandbox project into production.

- [ ] Create an empty production Supabase project.
- [ ] Create a live Paddle Researcher product and monthly recurring price without trial.
- [ ] Prepare a reviewed live billing migration with those live IDs and `environment = 'live'`.
- [ ] Apply base schemas to the empty project in this order: `development-bootstrap.sql`, `profile-settings.sql`, `germline-association-schema.sql`, `snv-disease-pipeline-schema.sql`, reviewed live billing migration.
- [ ] Import the required reference data using `supabase/imports/README.md`.
- [ ] Never copy sandbox customers, subscriptions or entitlements to production.
- [ ] Configure production authentication redirects, email delivery, backups and restore procedures.

Despite its filename, the guarded development bootstrap creates base tables only. Review its suitability before production use. The live migration is not generated in this task because the live IDs and authorization are not supplied. Do not run `paddle-billing.sql` unchanged against production, or rerun older schema migrations after billing.

## 7. Production configuration checklist — not applied

Enter real values in the production host, not source control. Leave local `.env.local` on sandbox.

```dotenv
NEXT_PUBLIC_APP_URL=https://YOUR_APPROVED_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=YOUR_PRODUCTION_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PRODUCTION_PUBLIC_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRODUCTION_SERVER_KEY
PADDLE_ENVIRONMENT=live
NEXT_PUBLIC_PADDLE_ENVIRONMENT=live
PADDLE_API_KEY=YOUR_LIVE_API_KEY
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=YOUR_LIVE_CLIENT_TOKEN
PADDLE_RESEARCHER_MONTHLY_PRICE_ID=YOUR_LIVE_PRICE_ID
PADDLE_RESEARCHER_PRODUCT_ID=YOUR_LIVE_PRODUCT_ID
PADDLE_WEBHOOK_SECRET=YOUR_LIVE_DESTINATION_SECRET
MODAL_ENDPOINT_URL=YOUR_PRODUCTION_EVO2_ENDPOINT
DISEASE_MODEL_ENDPOINT_URL=YOUR_PRODUCTION_DISEASE_ENDPOINT
MODAL_API_KEY=YOUR_PRODUCTION_MODAL_KEY
```

Never deploy the placeholder values. Production and preview environments must not share live billing credentials. Set the live default payment link to `https://YOUR_APPROVED_DOMAIN/billing/checkout`. Create a new live destination at `https://YOUR_APPROVED_DOMAIN/api/billing/webhook`. Follow the key permissions/event list in `BILLING_SETUP.md`.

Rebuild after changing `NEXT_PUBLIC_*` variables. The production database's `billing_config` must match the environment and live price/product IDs exactly. Keep genetic results out of payment metadata.

## 8. Release verification

Run each separately from `evo2-frontend`:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```

- [ ] Review final policy text; remove draft markers and noindex only when ready to publish.
- [ ] Verify public navigation, mobile layout and accessibility in a real browser.
- [ ] Verify signup, sign-in and password recovery with external email recipients.
- [ ] Verify actual Modal inference, cold starts and request timeouts on the selected host.
- [ ] Verify quota enforcement, history/export authorization and all scientific gating.
- [ ] Verify cancellation, refunds, deletion requests and account access against published policy.
- [ ] Verify live approval and webhook handling before an explicitly authorized real payment.
- [ ] Ensure a rollback can stop new purchases without deleting billing state or disabling existing-subscription webhooks/management.

No first real purchase is performed by these commands. Even an owner-card transaction requires separate approval/authorization and incurs real recurring charges.

## Verification record for this change

To be filled with results after local checks. Public price tests mock Paddle and create no transactions. Hosted billing state is not modified by verification.
