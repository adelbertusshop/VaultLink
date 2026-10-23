import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const appBaseUrl = Deno.env.get("APP_BASE_URL");
const allowedOrigins = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" })
  : null;

function json(body: unknown, status = 200, origin = "") {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const permittedOrigin = origin && allowedOrigins.includes(origin) ? origin : "";

  if (req.method === "OPTIONS") {
    if (!permittedOrigin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": permittedOrigin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin",
      },
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, permittedOrigin);
  if (!permittedOrigin) return json({ error: "Origin not allowed" }, 403);

  if (!stripe || !supabaseUrl || !supabaseAnonKey || !appBaseUrl) {
    return json({ error: "Checkout is not configured" }, 503, permittedOrigin);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return json({ error: "Authentication required" }, 401, permittedOrigin);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(tokenMatch[1]);
    if (authError || !user) return json({ error: "Invalid session" }, 401, permittedOrigin);

    const body = await req.json().catch(() => null);
    const plan = body?.plan;
    if (plan !== "monthly" && plan !== "yearly") {
      return json({ error: "Unsupported plan" }, 400, permittedOrigin);
    }

    const priceId = plan === "yearly"
      ? Deno.env.get("STRIPE_PRICE_YEARLY")
      : Deno.env.get("STRIPE_PRICE_MONTHLY");
    if (!priceId) return json({ error: "Selected plan is not configured" }, 503, permittedOrigin);

    const baseUrl = new URL(appBaseUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost") {
      return json({ error: "Invalid application URL configuration" }, 503, permittedOrigin);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: new URL("/app.html?upgraded=true", baseUrl).toString(),
      cancel_url: new URL("/pricing.html", baseUrl).toString(),
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
    });

    if (!session.url) return json({ error: "Checkout URL unavailable" }, 502, permittedOrigin);
    return json({ url: session.url }, 200, permittedOrigin);
  } catch {
    // Do not return provider or environment details to the browser.
    return json({ error: "Unable to create checkout session" }, 500, permittedOrigin);
  }
});
