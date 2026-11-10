import { NextResponse } from "next/server";
import { bank } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { refresh } from "@/lib/purchases";
import { verifySignature } from "@/lib/webhooks";

export const runtime = "nodejs";

// A signed event only triggers a status check with the bank; it never sets state on its own.
export async function POST(req: Request) {
  const raw = await req.text();
  const db = getDb();
  const secret = (db.prepare("SELECT value FROM settings WHERE key = 'webhook_secret'").get() as { value: string } | undefined)?.value;
  if (!secret || !verifySignature(raw, req.headers.get("x-forge-timestamp"), req.headers.get("x-forge-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let evt: { event?: string; event_id?: string; data?: { reference?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!evt.event_id || !evt.event) return NextResponse.json({ error: "missing event_id" }, { status: 400 });

  const fresh = db.prepare("INSERT OR IGNORE INTO webhook_events VALUES (?,?,?,?)").run(evt.event_id, evt.event, raw, new Date().toISOString());
  if (fresh.changes === 0) return NextResponse.json({ ok: true, duplicate: true });

  const ref = evt.data?.reference;
  if (ref && (evt.event.startsWith("transfer.") || evt.event.startsWith("payment."))) {
    const a = db.prepare("SELECT purchase_request_id FROM payment_attempts WHERE bank_reference = ?").get(ref) as { purchase_request_id: string } | undefined;
    if (a) await refresh(db, bank(), a.purchase_request_id);
  }
  return NextResponse.json({ ok: true });
}
