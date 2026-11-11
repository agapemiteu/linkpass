import { cn } from "@/lib/utils";

// Soft colour glows behind a page. Fixed to the viewport so the content column never clips them.
const GLOWS = {
  sunny: ["-top-32 -left-32 bg-sun/25", "top-40 -right-32 bg-lilac/20"],
  go: ["-top-24 left-1/4 bg-blue/20", "top-10 right-1/4 bg-mint/20"],
  ask: ["-top-24 left-1/4 bg-sun/30", "top-10 right-1/4 bg-coral/15"],
  stop: ["-top-24 left-1/4 bg-coral/25", "top-10 right-1/4 bg-sun/15"],
  neutral: ["-top-24 left-1/4 bg-lilac/20", "top-10 right-1/4 bg-blue/15"],
};

export function Backdrop({ tone }: { tone: keyof typeof GLOWS }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {GLOWS[tone].map((g) => (
        <span key={g} className={cn("absolute size-[28rem] rounded-full blur-3xl", g)} />
      ))}
    </div>
  );
}
