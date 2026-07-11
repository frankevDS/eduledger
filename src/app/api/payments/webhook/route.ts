import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Paystack (swap for Flutterwave/MoMo with the equivalent signature scheme)
// signs every webhook body with your secret key over HMAC-SHA512. Verifying
// it is what stops anyone who finds this URL from posting a fake
// "payment succeeded" event and getting a free receipt.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const secret = process.env.PAYSTACK_SECRET_KEY!;

  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event !== "charge.success") {
    // Acknowledge anything we don't act on so Paystack stops retrying it.
    return NextResponse.json({ received: true });
  }

  const { reference, amount, metadata } = event.data;
  const invoiceId = metadata?.invoice_id;
  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice_id in payment metadata" }, { status: 400 });
  }

  // Service-role client: a webhook has no logged-in user/session, so this
  // deliberately bypasses RLS. Nothing in this route trusts anything from
  // the request except what the verified signature covers.
  const admin = createAdminClient();

  const receiptNo = `RCT-${reference}`;
  const { error } = await admin.from("payments").insert({
    invoice_id: invoiceId,
    amount: amount / 100, // Paystack sends kobo/pesewas
    method: "card",
    provider_reference: reference,
    receipt_no: receiptNo,
  });

  if (error) {
    // Likely a duplicate webhook delivery (Paystack retries) hitting the
    // unique receipt_no constraint — treat that as already-handled, not a
    // failure, so Paystack doesn't keep retrying forever.
    if (error.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, receiptNo });
}
