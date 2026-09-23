# Paddle Billing setup

Public launch pages and the remaining production checklist are documented in [PRODUCTION_LAUNCH.md](./PRODUCTION_LAUNCH.md). Policies remain drafts until owner decisions and operational review are complete.

The application integration is implemented. No hosted migration, deployment, Paddle transaction, or real payment is performed by installing this code.

## 1. Apply the database migration

Use a separate development Supabase project with the existing application schemas, including `profiles`, `prediction_history`, `profile-settings.sql`, and `snv-disease-pipeline-schema.sql`.

For a **brand-new empty project**, first copy the complete setup to the clipboard using the following command, then paste and run it in that project's SQL Editor. Do not use this bootstrap on a project that already has application tables:

```powershell
Set-Location "C:\Users\Aawaiz\Desktop\variant-analysis-evo2\evo2-frontend"
$schemaFiles = @(
  ".\supabase\development-bootstrap.sql",
  ".\supabase\profile-settings.sql",
  ".\supabase\germline-association-schema.sql",
  ".\supabase\snv-disease-pipeline-schema.sql",
  ".\supabase\paddle-billing.sql"
)
($schemaFiles | ForEach-Object { Get-Content -Raw -LiteralPath $_ }) -join "`r`n" | Set-Clipboard
```

This creates empty application tables; it does not clone users or clinical reference data. Create a new test user in the app. Reference-data import instructions are in `supabase/imports/README.md` if you also want to test disease ranking.

For an **existing development project** with the application schema already installed, run only the billing migration. From PowerShell:

```powershell
Set-Location "C:\Users\Aawaiz\Desktop\variant-analysis-evo2\evo2-frontend"
Get-Content -Raw ".\supabase\paddle-billing.sql" | Set-Clipboard
```

Paste into the development project's Supabase SQL Editor and run. This migration contains the supplied sandbox product and price IDs, but no credentials. It removes demo entitlements, protects profile billing fields, makes model caches server-only, and restricts direct history reads to subscribers. It preserves existing history.

Do not rerun older profile/SNV migrations after this migration: they can restore obsolete constraints and grants. If restoring a database, apply this billing migration last. Back up existing databases before a live rollout.

## 2. Environment variables

Keep existing Modal configuration. If switching Supabase projects, update the URL, public key and server key together. In Supabase, use Connect for the project URL and Settings > API Keys for keys. The current Supabase SDK supports a server secret key (`sb_secret_...`) or legacy `service_role` key under this app's existing `SUPABASE_SERVICE_ROLE_KEY` variable. Never use an anon/publishable key for that variable.

```dotenv
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=<server API key>
PADDLE_RESEARCHER_MONTHLY_PRICE_ID=pri_01m2z97w73ff7j0we1nvv89txb
PADDLE_RESEARCHER_PRODUCT_ID=pro_01m2z8swqyc7g3v02bx4n8sa5c
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<client token>
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<development project server key>
PADDLE_WEBHOOK_SECRET=<notification destination secret, added in step 4>
```

Use the actual values without angle brackets. Do not replace existing secrets with placeholders. Billing validates configuration on use; a build can run before the webhook secret exists, but checkout will not open until it is configured.

Backend Paddle key permissions: `product.read`, `price.read`, `customer.write`, `transaction.write`, `subscription.read`, `customer_portal_session.write`, **`adjustment.read`**. The last permission is needed to verify refunds from the API. Configure the Researcher price as recurring without a trial. Prices displayed in Settings are read from Paddle, not hardcoded.

## 3. Run locally and expose the webhook

```powershell
npm install
npx next dev --turbo --port 3000
```

In a second terminal:

```powershell
winget install --id Cloudflare.cloudflared --exact --source winget
```

Reopen that terminal after installation, then:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Keep both terminals running. Use localhost in the browser; the tunnel only needs to deliver webhook requests. Quick tunnel addresses change between sessions.

## 4. Paddle Sandbox fields

Checkout > Checkout settings > Default payment link:

```text
http://localhost:3000/billing/checkout
```

Developer tools > Notifications > New destination:

| Field             | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| Description       | Evo2 sandbox billing webhook                              |
| Notification type | Webhook / URL                                             |
| URL               | https://YOUR-TUNNEL.trycloudflare.com/api/billing/webhook |
| API version       | 1                                                         |
| Usage type        | All (platform and simulation)                             |

Subscribe to:

```text
subscription.created
subscription.updated
subscription.activated
subscription.canceled
subscription.paused
subscription.resumed
subscription.past_due
subscription.trialing
transaction.completed
transaction.updated
transaction.payment_failed
transaction.past_due
transaction.canceled
adjustment.created
adjustment.updated
```

Save its secret as `PADDLE_WEBHOOK_SECRET`. Restart Next.js. Never paste secrets into screenshots, commits, or support messages.

## 5. Manual acceptance tests

Sign in at `http://localhost:3000`, then Settings > Plans > Upgrade to Researcher > Continue to secure checkout.

| Scenario                       | Test data / expected result                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Success                        | `4242424242424242`, future expiry, `123`; Researcher after verified provider state |
| Decline                        | `4000000000000002`; Student remains                                                |
| 3DS                            | `4000003800000446`; complete the authentication challenge                          |
| Renewal decline                | `4000002760003184`; initial success, later collection fails                        |
| Browser closes after payment   | Webhook still grants access                                                        |
| Double click / two tabs        | Reuses one transaction; no duplicate creation                                      |
| Cancellation scheduled         | Active until its effective time                                                    |
| Immediate cancellation / pause | Student for new operations; stored history is not deleted                          |
| Past due                       | Student limits until payment recovery                                              |
| Payment recovery               | Researcher restored                                                                |
| Refund                         | Stored as an adjustment; refund alone does not cancel a subscription               |
| Duplicate or old webhook       | No duplicate records or stale-state overwrite                                      |
| Wrong signature                | HTTP 400; no access update                                                         |
| Database failure               | HTTP 5xx so Paddle can retry                                                       |
| Expired billing period         | Fails closed to Student until renewal is confirmed                                 |
| Direct database writes         | Browser cannot assign a plan, write billing records, or modify caches              |
| Benign/VUS                     | Existing scientific rules remain in force after upgrading                          |

Check Paddle notification logs, the billing tables, and Settings. A browser success redirect alone never grants access.

The handler fetches current Paddle entities before applying a signed event. Simulator fixtures with invented subscription IDs cannot grant access. Use actual sandbox entities for integration tests. Offline tests cover ordering/signatures and database rules separately.

## 6. Recovery and support

Confirmed transaction-creation rejections for recognized configuration, authentication, or validation errors release the failed checkout attempt automatically and display Paddle's error code. Correct the reported configuration before retrying. Transport failures, server errors, and unknown outcomes remain reserved to prevent duplicate purchases.

Settings > Refresh status reconciles subscriptions and a pending checkout with Paddle. It is limited to once per 30 seconds per user. The confirmation page polls the local state for 30 seconds; it never automatically buys again. Reconciliation intentionally scans one provider page per request because this app sells one subscription per customer. Larger account histories need an operator reconciliation job before expanding the product.

On a provider timeout the checkout remains reserved: Paddle may have created the transaction even if the response was lost. The refresh action can recover it using `checkout_attempt_id`. If customer creation failed before its ID was persisted, or no matching transaction can be located, inspect Paddle and `billing_checkouts` manually. Do not delete/reset the attempt until you have established there is no payable transaction or have canceled it in Paddle. Then an operator may mark that specific attempt `canceled` using the SQL Editor. This prevents an ambiguous failure from becoming a duplicate charge.

Unrelated purchases whose Paddle customer is not mapped to an application account are ignored; email or browser-supplied user IDs never grant ownership. Transactions created by this app persist the customer mapping before opening checkout.

Refund policy for this first version: record adjustments; do not automatically change access solely because of a refund. To end service, also cancel the subscription through Paddle. Cancellation, payment status, and period expiry govern access.

Quotas count a normalized variant once per UTC day across all analysis routes. Failed reservations are released exactly once. An interrupted request can resume after five minutes without another charge to the quota. A completed same-day analysis or VUS exploration reuses that variant's allowance. Upgrading changes the limit, not consumption. Usage data and genetic results stay in Supabase, never in Paddle metadata.

## 7. Automated checks

```powershell
npm run test
npm run typecheck
npm run build
```

Database tests run the actual migration against embedded PostgreSQL (PGlite), not your Supabase project. No payment credentials are needed by tests. Keep separate staging users and mock inference for billing exercises to avoid unnecessary GPU costs.

## 8. Deployment and eventual live processing

Deploy with project root `evo2-frontend`, install `npm ci`, build `npm run build`, and start `npm run start` where required. Set secrets in the host's environment settings. Set `NEXT_PUBLIC_APP_URL` to the exact HTTPS application origin; update Supabase Auth redirect URLs and Paddle's default payment link and webhook destination. Rebuild when changing `NEXT_PUBLIC_*` variables. Remove preview protection for the webhook URL so Paddle can reach it.

Do not switch to live until Paddle approves the actual genetic-analysis product, verifies the seller, approves the domain, and confirms payout details. Use a separate live Supabase project. In the live copy of this migration change the `billing_config` insert to the live environment and approved live price/product IDs **before applying it**. Use live credentials, token and destination secret, set both environment variables to `live`, and redeploy. Configuration checks prevent using a sandbox database with live credentials or vice versa.

Official references: [Paddle setup](https://developer.paddle.com/build/set-up-checklist/), [sandbox](https://developer.paddle.com/sdks/sandbox/), [signatures](https://developer.paddle.com/webhooks/about/signature-verification/), [notification destinations](https://developer.paddle.com/webhooks/about/notification-destinations/).
