import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

// Demo Mode sessions: a signed cookie naming a seeded user. Role always comes from the database, never the client.
const COOKIE = "lp_session";
const secret = () => process.env.SESSION_SECRET ?? process.env.GATEWAY_KEY ?? "local-dev-only";

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export type SessionUser = { id: string; displayName: string; role: "GUARDIAN" | "CHILD"; familyId: string };

export async function setSession(userId: string) {
  (await cookies()).set(COOKIE, `${userId}.${sign(userId)}`, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  const id = raw.slice(0, i);
  const sig = Buffer.from(raw.slice(i + 1));
  const want = Buffer.from(sign(id));
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  const u = await (await getDb()).get<{ id: string; display_name: string; role: "GUARDIAN" | "CHILD"; family_id: string }>(
    "SELECT id, display_name, role, family_id FROM users WHERE id = ?", id,
  );
  return u ? { id: u.id, displayName: u.display_name, role: u.role, familyId: u.family_id } : null;
}

export class AuthError extends Error {
  constructor(public httpStatus: number) {
    super(httpStatus === 401 ? "Sign in first" : "Not allowed");
  }
}

export async function requireRole(role: SessionUser["role"]) {
  const u = await currentUser();
  if (!u) throw new AuthError(401);
  if (u.role !== role) throw new AuthError(403);
  return u;
}

export async function childOf(familyId: string) {
  return (await getDb()).get<{ id: string; display_name: string }>("SELECT id, display_name FROM users WHERE family_id = ? AND role = 'CHILD' LIMIT 1", familyId);
}
