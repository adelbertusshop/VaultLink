# VaultLink Stripe Edge Functions — test branch

These files are proposed source for review and deployment. Committing them to GitHub does **not** change the live Supabase functions.

## Required Supabase Edge Function secrets / variables

Configure values in the VaultLink Supabase project's Edge Function secrets (never commit actual values):

- `STRIPE_SECRET_KEY`: Stripe secret key for the intended test/live mode.
- `STRIPE_PRICE_MONTHLY`: Stripe Price ID for the monthly plan.
- `STRIPE_PRICE_YEARLY`: Stripe Price ID for the yearly plan.
- `APP_BASE_URL`: canonical app origin for this deployment.
- `APP_ALLOWED_ORIGINS`: comma-separated exact browser origins allowed to call checkout; include the matching Vercel preview origin only when testing.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the Stripe endpoint pointing to `stripe-webhook`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: required by `create-checkout`.
- `SUPABASE_SERVICE_ROLE_KEY`: required only by `stripe-webhook`; server-side secret, never expose to browser code.

Use test-mode Stripe credentials and test Price IDs for Preview. Production credentials and production Price IDs must remain separate.

## Deployment order

1. Review and test this source on the GitHub test branch.
2. Configure Preview/test secrets in Supabase only after confirming the target environment.
3. Deploy `create-checkout` with JWT verification enabled.
4. Deploy `stripe-webhook` with platform JWT verification disabled; the handler independently verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`.
5. Send Stripe test events and verify subscription rows and cancellation/downgrade behavior.
6. Do not deploy to Production until a separate explicit approval.

## Security decisions

- Checkout derives the user identity from a verified Supabase access token.
- The browser supplies only `plan: monthly|yearly`; it cannot choose the price, account ID, email, or redirect URLs.
- Checkout prices and redirect URLs come from server-side configuration.
- The webhook verifies Stripe's signature against the raw request body.
- Database errors return 5xx so Stripe can retry.
- Plan enforcement must also be server-side for any privileged operation; hiding a Pro feature in the browser is not authorization.
