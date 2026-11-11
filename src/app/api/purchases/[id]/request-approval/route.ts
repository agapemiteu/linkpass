import { handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requestApproval } from "@/lib/purchases";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const child = await requireRole("CHILD");
    await requestApproval((await getDb()), (await params).id, child.id);
  });
}
