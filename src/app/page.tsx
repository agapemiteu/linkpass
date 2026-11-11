import { Avatar } from "@/components/avatar";
import { RoleChooser } from "@/components/role-chooser";

export default function Welcome() {
  return (
    <main className="flex min-h-dvh flex-col justify-between py-10">
      <div className="pt-8">
        <p className="text-[17px] font-semibold tracking-tight">LinkPass</p>
        <h1 className="mt-10 text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.03em]">
          Let your children shop independently, on your terms.
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted">
          They find it online. You set the rules once. Anything inside the rules is paid straight away. Anything outside them comes to you.
        </p>
      </div>
      <div>
        <p className="mb-3 text-[13px] font-medium text-muted">Choose who&apos;s using LinkPass · Demo Mode</p>
        <RoleChooser
          roles={[
            { id: "guardian_001", label: "Adaeze", sub: "Parent", to: "/parent", avatar: <Avatar seed="Adaeze" size={48} /> },
            { id: "child_001", label: "Mira", sub: "Shopper, 15", to: "/child", avatar: <Avatar seed="Mira" size={48} /> },
          ]}
        />
      </div>
    </main>
  );
}
