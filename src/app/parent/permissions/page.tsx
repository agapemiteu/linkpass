import { redirect } from "next/navigation";
import { childOf, currentUser } from "@/lib/auth";
import { familySummary, verifiedMerchants } from "@/lib/views";
import { TopBar } from "@/components/ui";
import { PermissionsForm } from "@/components/permissions-form";

export const dynamic = "force-dynamic";

export default async function Permissions() {
  const user = await currentUser();
  if (user?.role !== "GUARDIAN") redirect("/");
  const child = childOf(user.familyId)!;
  const { policy } = familySummary(child.id);
  const daysLeft = policy ? Math.max(1, Math.ceil((new Date(policy.expiresAt).getTime() - Date.now()) / 86400_000)) : 30;

  return (
    <main>
      <TopBar name={user.displayName} role="parent" />
      <h1 className="font-display text-3xl font-medium tracking-tight">Shopping permissions for {child.display_name}</h1>
      <p className="mt-2 text-sm text-muted">Purchases inside these rules go through without you. Anything outside them comes to you first.</p>
      <PermissionsForm
        childName={child.display_name}
        merchants={verifiedMerchants()}
        initial={{
          maxSingle: policy ? policy.maximumSinglePurchaseKobo / 100 : 20000,
          daily: policy ? policy.dailyLimitKobo / 100 : 40000,
          merchantIds: policy?.merchants.map((m) => m.merchantId) ?? [],
          categories: policy?.categories ?? ["clothing", "footwear"],
          days: daysLeft,
        }}
        hasPolicy={!!policy}
      />
    </main>
  );
}
