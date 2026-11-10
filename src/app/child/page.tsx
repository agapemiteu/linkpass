import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { familySummary, ngn, purchasesFor, STATUS_LABEL, TONE } from "@/lib/views";
import { Card, Pill, TopBar } from "@/components/ui";
import { Discover } from "@/components/discover";

export const dynamic = "force-dynamic";

export default async function ChildHome() {
  const user = await currentUser();
  if (user?.role !== "CHILD") redirect("/");
  const { balances, policy, merchantNames } = familySummary(user.id);
  const purchases = purchasesFor(user.id, 8);

  return (
    <main>
      <TopBar name={user.displayName} role="child" />

      <h1 className="font-display mt-4 text-3xl font-medium tracking-tight">Found something you love?</h1>
      <Discover />

      <Card className="mt-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted">You can spend</p>
            <p className="tabular font-display text-3xl font-medium">{ngn(balances.availableKobo)}</p>
          </div>
          {policy && <p className="text-right text-sm text-muted">Up to {ngn(policy.maximumSinglePurchaseKobo)}<br />per item</p>}
        </div>
        {policy ? (
          <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
            Shops you can buy from on your own: <span className="text-ink">{merchantNames.map((m) => m.display_name).join(", ") || "none yet"}</span>
          </p>
        ) : (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ask">No shopping permissions are active. Everything goes to your parent.</p>
        )}
      </Card>

      {purchases.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted">Recent</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/child/p/${p.id}`} className="flex items-center gap-3 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt="" className="size-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="tabular text-sm text-muted">{ngn(p.price_kobo)} · {p.merchant}</p>
                  </div>
                  <Pill tone={TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
