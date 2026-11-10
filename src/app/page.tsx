import { RoleChooser } from "@/components/role-chooser";

export default function Welcome() {
  return (
    <main className="flex min-h-dvh flex-col justify-between py-10">
      <div className="pt-10">
        <p className="font-display text-2xl font-semibold tracking-tight">LinkPass</p>
        <h1 className="font-display mt-10 text-[2.6rem] leading-[1.05] font-medium tracking-tight">
          Let your children shop independently, on your terms.
        </h1>
        <p className="mt-5 text-muted">
          Kids find what they love online. Parents set the rules once. Purchases inside the rules go through; anything else comes to you.
        </p>
      </div>
      <div>
        <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Demo Mode · synthetic accounts</p>
        <RoleChooser />
      </div>
    </main>
  );
}
