import type { Db } from "@/lib/db";

// URLs are parsed, never fetched: no server-side requests to user-supplied addresses (SSRF).
export function parseSocialUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const platform = host.endsWith("instagram.com") ? "instagram" : host.endsWith("tiktok.com") ? "tiktok" : "web";
  const first = u.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "").toLowerCase();
  const handle = platform !== "web" && first && !["p", "reel", "video"].includes(first) ? first : null;
  return { platform, handle, canonical: `https://www.${host}${u.pathname.replace(/\/$/, "")}` };
}

export type OfferMatch = {
  offer: { id: string; title: string; description: string; category: string; image_url: string; price_kobo: number; status: string };
  merchant: { id: string; display_name: string; verified: boolean; resolved_account_name: string; bank_account_number: string };
  handle: string;
  matchedBy: "seeded_link" | "seller_and_title";
};

type Row = {
  id: string; title: string; description: string; category: string; image_url: string; price_kobo: number; status: string;
  m_id: string; display_name: string; identity_verification_status: string; resolved_account_name: string; bank_account_number: string; handle: string;
};

const SELECT = `SELECT o.*, m.id AS m_id, m.display_name, m.identity_verification_status, m.resolved_account_name, m.bank_account_number, s.handle
  FROM offers o JOIN merchants m ON m.id = o.merchant_id JOIN merchant_social_profiles s ON s.merchant_id = m.id`;

const toMatch = (r: Row, matchedBy: OfferMatch["matchedBy"]): OfferMatch => ({
  offer: { id: r.id, title: r.title, description: r.description, category: r.category, image_url: r.image_url, price_kobo: Number(r.price_kobo), status: r.status },
  merchant: { id: r.m_id, display_name: r.display_name, verified: r.identity_verification_status === "VERIFIED", resolved_account_name: r.resolved_account_name, bank_account_number: r.bank_account_number },
  handle: r.handle,
  matchedBy,
});

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));

// Exact identity first: the seller is whoever the registered profile says, never a lookalike.
export async function matchOffer(db: Db, input: { canonicalUrl?: string; platform?: string; handle?: string | null; title?: string | null }): Promise<OfferMatch | null> {
  if (input.canonicalUrl) {
    const r = await db.get<Row>(`${SELECT} WHERE o.demo_link = ?`, input.canonicalUrl);
    if (r) return toMatch(r, "seeded_link");
  }
  if (!input.handle || !input.title) return null;
  const rows = await db.all<Row>(`${SELECT} WHERE s.platform = ? AND s.handle = ?`, input.platform ?? "instagram", input.handle.toLowerCase());
  const want = words(input.title);
  let best: { r: Row; score: number } | null = null;
  for (const r of rows) {
    const have = words(r.title);
    const overlap = [...want].filter((w) => have.has(w)).length / Math.max(want.size, 1);
    if (!best || overlap > best.score) best = { r, score: overlap };
  }
  return best && best.score >= 0.5 ? toMatch(best.r, "seller_and_title") : null;
}
