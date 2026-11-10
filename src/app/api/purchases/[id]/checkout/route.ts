import { appBaseUrl, demoMode, handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { bank } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { startCheckout } from "@/lib/purchases";

export const runtime = "nodejs";

// In Demo Mode the bank sends the parent back to whatever address they opened the app on
// (e.g. a kubectl port-forward while the public URL is gated). Payment is still confirmed by verify, never by the redirect.
function returnBase(req: Request) {
  const host = req.headers.get("host");
  if (!demoMode() || !host) return appBaseUrl();
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guardian = await requireRole("GUARDIAN");
    return startCheckout(getDb(), bank(), (await params).id, guardian, returnBase(req));
  });
}
