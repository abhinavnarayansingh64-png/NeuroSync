import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stripeSource = readFileSync(resolve(process.cwd(), "server/stripe.ts"), "utf8");

describe("Premium checkout contract", () => {
  it("binds hosted Checkout sessions to the authenticated user and uses a subscription", () => {
    expect(stripeSource).toContain("mode: \"subscription\"");
    expect(stripeSource).toContain("client_reference_id: String(input.userId)");
    expect(stripeSource).toContain("user_id: String(input.userId)");
    expect(stripeSource).toContain("allow_promotion_codes: true");
    expect(stripeSource).toContain("/membership?premium=success&session_id={CHECKOUT_SESSION_ID}");
    expect(stripeSource).toContain("/membership?premium=cancelled");
    expect(stripeSource).toContain("createPremiumBillingPortal");
    expect(stripeSource).toContain("stripe.billingPortal.sessions.create");
  });

  it("verifies raw signed webhooks and handles test events without granting entitlement", () => {
    expect(stripeSource).toContain('express.raw({ type: "application/json" })');
    expect(stripeSource).toContain("webhooks.constructEvent(req.body, signature, secret)");
    expect(stripeSource).toContain('event.id.startsWith("evt_test_")');
    expect(stripeSource).toContain("return res.json({ verified: true })");
  });
});
