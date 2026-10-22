import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import * as neuro from "./neurosyncDb";
import { PREMIUM_MEMBERSHIP } from "./products";

let stripeClient: Stripe | undefined;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured for this project.");
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

function safeOrigin(origin: string | undefined) {
  if (origin?.startsWith("https://") || origin?.startsWith("http://localhost")) return origin;
  return process.env.GPU_PROVIDER_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function createPremiumCheckout(input: { userId: number; email?: string | null; name?: string | null; origin?: string }) {
  const stripe = getStripe();
  const membership = await neuro.getMembership(input.userId);
  const origin = safeOrigin(input.origin);
  const metadata = {
    user_id: String(input.userId),
    customer_email: input.email ?? "",
    customer_name: input.name ?? "",
    plan: "premium",
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: membership.stripeCustomerId ?? undefined,
    customer_email: membership.stripeCustomerId ? undefined : input.email ?? undefined,
    client_reference_id: String(input.userId),
    metadata,
    allow_promotion_codes: true,
    line_items: [{
      price_data: {
        currency: PREMIUM_MEMBERSHIP.currency,
        recurring: { interval: PREMIUM_MEMBERSHIP.interval },
        product_data: { name: PREMIUM_MEMBERSHIP.name, description: PREMIUM_MEMBERSHIP.description },
        unit_amount: PREMIUM_MEMBERSHIP.unitAmount,
      },
      quantity: 1,
    }],
    subscription_data: { metadata },
    success_url: `${origin}/membership?premium=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/membership?premium=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url };
}

export async function createPremiumBillingPortal(input: { userId: number; origin?: string }) {
  const stripe = getStripe();
  const membership = await neuro.getMembership(input.userId);
  if (!membership.stripeCustomerId) {
    throw new Error("No Stripe billing profile exists yet. Start Premium Checkout first, or revoke an active workspace trial from the membership page.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: membership.stripeCustomerId,
    return_url: `${safeOrigin(input.origin)}/membership`,
  });
  return { url: session.url };
}

async function handlePremiumEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = Number(session.client_reference_id ?? session.metadata?.user_id);
    if (Number.isInteger(userId) && userId > 0) {
      await neuro.setPremiumMembership({
        userId,
        status: "active",
        entitlementSource: "stripe_checkout",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
      });
    }
  }
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = Number(subscription.metadata?.user_id);
    if (Number.isInteger(userId) && userId > 0) {
      await neuro.setPremiumMembership({ userId, status: "cancelled", entitlementSource: "stripe_subscription" });
    }
  }
}

export function registerStripeRoutes(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || typeof signature !== "string") return res.status(400).json({ error: "Missing Stripe webhook signature or configuration." });
    try {
      const event = getStripe().webhooks.constructEvent(req.body, signature, secret);
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe] Test event detected, returning verification response");
        return res.json({ verified: true });
      }
      await handlePremiumEvent(event);
      console.log(`[Stripe] Processed ${event.type} (${event.id})`);
      return res.json({ received: true });
    } catch (error) {
      console.error("[Stripe] Webhook verification failed", error);
      return res.status(400).json({ error: "Invalid Stripe webhook." });
    }
  });
}
