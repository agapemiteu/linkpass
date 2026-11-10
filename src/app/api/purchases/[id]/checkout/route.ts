import { appBaseUrl, handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { bank } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { startCheckout } from "@/lib/purchases";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const guardian = await requireRole("GUARDIAN");
    return startCheckout(getDb(), bank(), (await params).id, guardian, appBaseUrl());
  });
}
