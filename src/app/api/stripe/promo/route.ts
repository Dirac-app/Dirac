import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { formatPromotionSummary, resolvePromotionCode } from "@/lib/stripe-promo";

/** Validate a customer-facing promo code (does not redeem it). */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
  }

  const stripe = getStripe();
  const promo = await resolvePromotionCode(stripe, code);
  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid or expired promo code" }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    code: promo.code,
    summary: formatPromotionSummary(promo),
    percentOff: promo.percentOff,
    duration: promo.duration,
  });
}
