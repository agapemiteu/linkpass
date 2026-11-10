import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { PurchaseError } from "@/lib/purchases";
import { BankError } from "@/lib/bank/types";

export function handle(fn: () => Promise<unknown>) {
  return fn()
    .then((data) => NextResponse.json(data ?? { ok: true }))
    .catch((e) => {
      if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
      if (e instanceof PurchaseError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
      if (e instanceof BankError) return NextResponse.json({ error: `Bank: ${e.message}`, code: e.code }, { status: 502 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    });
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new PurchaseError("INVALID_JSON", "Invalid request body");
  }
}

export const demoMode = () => process.env.DEMO_MODE !== "false";
export const appBaseUrl = () => process.env.APP_BASE_URL ?? "http://localhost:3000";
