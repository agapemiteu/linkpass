import { body, handle } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { extractProduct } from "@/lib/ai/extraction";
import { matchOffer, parseSocialUrl } from "@/lib/merchants/matching";
import { PurchaseError } from "@/lib/purchases";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handle(async () => {
    await requireRole("CHILD");
    const b = await body<{ source_url?: string; description?: string; image?: string }>(req);
    const url = b.source_url?.trim().slice(0, 500);
    const description = b.description?.trim().slice(0, 500);
    const image = b.image && /^data:image\/(png|jpe?g|webp);base64,/.test(b.image) && b.image.length < 3_000_000 ? b.image : undefined;
    if (!url && !image && !description) throw new PurchaseError("EMPTY", "Paste a link or add a screenshot");

    const parsed = url ? parseSocialUrl(url) : null;
    if (url && !parsed) throw new PurchaseError("BAD_URL", "That doesn't look like a web link");

    const ai = await extractProduct({ url, description, imageDataUrl: image });
    const db = (await getDb());
    const handleName = ai.extraction?.claimed_seller_handle?.replace(/^@/, "").toLowerCase() ?? parsed?.handle ?? null;
    const match = await matchOffer(db, {
      canonicalUrl: parsed?.canonical,
      platform: parsed?.platform === "web" ? "instagram" : parsed?.platform,
      handle: parsed?.handle ?? handleName,
      title: ai.extraction?.product_title ?? description ?? null,
    });

    return {
      ai: { source: ai.source, model: ai.model, extraction: ai.extraction, error: ai.error ? "AI unavailable, matched from the link only" : undefined },
      claimed_handle: parsed?.handle ?? handleName,
      match,
      needs_clarification: !match,
    };
  });
}
