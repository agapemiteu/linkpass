import { createHmac, timingSafeEqual } from "node:crypto";

// Forge signs "{timestamp}.{raw_body}" with HMAC-SHA256 and sends "sha256=<hex>".
export function verifySignature(raw: string, timestamp: string | null, signature: string | null, secret: string, nowMs = Date.now()) {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return false;
  const want = Buffer.from("sha256=" + createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex"));
  const got = Buffer.from(signature);
  return got.length === want.length && timingSafeEqual(got, want);
}
