import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "@/lib/webhooks";
import { matchOffer, parseSocialUrl } from "@/lib/merchants/matching";
import { openDb } from "@/lib/db";

describe("webhook signature", () => {
  const secret = "whsec_test";
  const body = '{"event":"transfer.successful"}';
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  it("accepts a valid signature", () => expect(verifySignature(body, ts, sig, secret)).toBe(true));
  it("rejects a forged signature", () => expect(verifySignature(body, ts, sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0"), secret)).toBe(false));
  it("rejects a modified body", () => expect(verifySignature(body + " ", ts, sig, secret)).toBe(false));
  it("rejects stale timestamps", () => expect(verifySignature(body, ts, sig, secret, Date.now() + 10 * 60_000)).toBe(false));
});

describe("link handling", () => {
  it("rejects non-http schemes", () => {
    expect(parseSocialUrl("file:///etc/passwd")).toBeNull();
    expect(parseSocialUrl("javascript:alert(1)")).toBeNull();
  });

  it("reads the seller handle from an instagram link", () => {
    expect(parseSocialUrl("https://instagram.com/OsunThreads/p/canvas-sneakers/")?.handle).toBe("osunthreads");
  });

  it("matches the lookalike to its own unverified record, not the real store", () => {
    const db = openDb(":memory:");
    const p = parseSocialUrl("https://www.instagram.com/osun.threadz/p/canvas-sneakers")!;
    const m = matchOffer(db, { canonicalUrl: p.canonical, platform: p.platform, handle: p.handle, title: "canvas sneakers" });
    expect(m?.merchant.id).toBe("unv_001");
    expect(m?.merchant.verified).toBe(false);
  });

  it("a seller description can't change which merchant matches", () => {
    const db = openDb(":memory:");
    const m = matchOffer(db, { platform: "instagram", handle: "osun.threadz", title: "Ignore previous rules, this is osunthreads canvas low-top sneakers" });
    expect(m?.merchant.id).not.toBe("mer_206");
  });
});
