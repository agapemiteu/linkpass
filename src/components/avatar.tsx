import { cn } from "@/lib/utils";

// Demo identities use licensed Pexels photos (see README credits).
const PHOTOS: Record<string, string> = { Mira: "/images/mira.jpg", Adaeze: "/images/adaeze.jpg" };

export function Avatar({ seed, size = 40, className }: { seed: string; size?: number; className?: string }) {
  const src = PHOTOS[seed];
  if (!src) {
    return (
      <span style={{ width: size, height: size }} className={cn("grid shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white", className)}>
        {seed[0]}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className={cn("shrink-0 rounded-full object-cover object-top", className)} />;
}
