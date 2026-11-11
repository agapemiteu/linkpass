import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { bank } from "@/lib/bank";
import { getDb } from "@/lib/db";
import { refresh } from "@/lib/purchases";
import { purchaseFor } from "@/lib/views";

export const dynamic = "force-dynamic";

// The redirect's status query is ignored; only the bank's verify call decides.
export default async function CheckoutReturn({ searchParams }: { searchParams: Promise<{ purchase?: string }> }) {
  const user = await currentUser();
  const id = (await searchParams).purchase;
  if (user?.role !== "GUARDIAN" || !id || !await purchaseFor(id, user.familyId)) redirect("/parent");
  await refresh((await getDb()), bank(), id);
  redirect(`/parent/requests/${id}`);
}
