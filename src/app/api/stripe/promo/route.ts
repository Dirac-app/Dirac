import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  type BillingPlan,
  planForPromoCode,
  promoPlanMismatchMessage,
} from "@/lib/stripe-promo-config";
import { formatPromotionSummary, resolvePromotionCode } from "@/lib/stripe-promo";

/** Validate a customer-facing promo code (does not redeem it). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const planParam = searchParams.get("plan");
  const plan =
    planParam === "monthly" || planParam === "annual" ? (planParam as BillingPlan) : null;

  if (!code) {
    return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
  }

  const stripe = getStripe();
  const promo = await resolvePromotionCode(stripe, code);
  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid or expired promo code" }, { status: 404 });
  }

  if (plan) {
    const mismatch = promoPlanMismatchMessage(promo.code, plan);
    if (mismatch) {
      return NextResponse.json({ valid: false, error: mismatch }, { status: 400 });
    }
  }

  return NextResponse.json({
    valid: true,
    code: promo.code,
    summary: formatPromotionSummary(promo),
    percentOff: promo.percentOff,
    duration: promo.duration,
    durationInMonths: promo.durationInMonths,
    plan: planForPromoCode(promo.code),
  });
}
