import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { childOf, currentUser } from "@/lib/auth";
import { familySummary, verifiedMerchants } from "@/lib/views";
import { Icon, TopBar } from "@/components/ui";
import { PermissionsForm } from "@/components/permissions-form";

export const dynamic = "force-dynamic";

export default async function Permissions() {
  const user = await currentUser();
  if (user?.role !== "GUARDIAN") redirect("/");
  const child = (await childOf(user.familyId))!;
  const { policy } = await familySummary(child.id);
  const daysLeft = policy ? Math.max(1, Math.ceil((new Date(policy.expiresAt).getTime() - Date.now()) / 86400_000)) : 30;

  return (
    <main className="mx-auto max-w-md px-4 pb-16">
      <TopBar name={user.displayName} role="parent" />
      <Link href="/parent" className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-muted hover:text-ink">
        <Icon icon={ArrowLeft01Icon} size={18} /> Home
      </Link>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]">Shopping permissions</h1>
      <p className="mt-1 text-[15px] text-muted">What {child.display_name} can buy without asking you. Saving creates a new version; earlier ones are kept.</p>
      <PermissionsForm
        childName={child.display_name}
        merchants={await verifiedMerchants()}
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
