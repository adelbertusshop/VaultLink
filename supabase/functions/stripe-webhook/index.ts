import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
  console.error("Stripe webhook environment is incomplete");
}

const stripe = new Stripe(stripeSecretKey ?? "", { apiVersion: "2023-10-16" });
const supabase = createClient(supabaseUrl ?? "", serviceRoleKey ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

function customerIdOf(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function saveSubscription(input: {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  status: string;
  currentPeriodEnd?: number | null;
}) {
  const active = input.status === "active" || input.status === "trialing";
  const row: Record<string, unknown> = {
    user_id: input.userId,
    plan: active ? "pro" : "free",
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
    current_period_end: input.currentPeriodEnd
      ? new Date(input.currentPeriodEnd * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response("Webhook is not configured", { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return new Response("Invalid Stripe signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;
      if (session.mode === "subscription" && userId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await saveSubscription({
          userId,
          customerId: customerIdOf(subscription.customer),
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
        });
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await saveSubscription({
          userId,
          customerId: customerIdOf(subscription.customer),
          subscriptionId: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
        });
      } else {
        // Legacy subscriptions may not have user metadata; update only the
        // existing row associated with the Stripe customer ID.
        const customerId = customerIdOf(subscription.customer);
        if (customerId) {
          const active = subscription.status === "active" || subscription.status === "trialing";
          const { error } = await supabase.from("subscriptions")
            .update({
              plan: active ? "pro" : "free",
              stripe_subscription_id: subscription.id,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);
          if (error) throw error;
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // A 5xx response asks Stripe to retry; never report success after DB failure.
    return new Response("Unable to process event", { status: 500 });
  }
});
