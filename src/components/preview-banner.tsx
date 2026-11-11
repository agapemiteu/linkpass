import { connection } from "next/server";

// Shown on any build not wired to the Forge sandbox, so nobody mistakes mock payments for real ones.
// Read at request time: a static page would bake in the build machine's settings.
export async function PreviewBanner() {
  await connection();
  if (process.env.BANK_PROVIDER === "forge") return null;
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-white">
      Preview build · mock bank, link-only matching. The live demo runs on the Access Forge sandbox.
    </div>
  );
}
