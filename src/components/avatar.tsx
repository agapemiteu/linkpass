import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";
import { cn } from "@/lib/utils";

// Generated in-process; no request to DiceBear's servers.
const cache = new Map<string, string>();

export function Avatar({ seed, size = 40, className }: { seed: string; size?: number; className?: string }) {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(notionists, { seed, backgroundColor: ["f1e7da", "dfe8f2", "e6efe0"] }).toDataUri();
    cache.set(seed, uri);
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} alt="" width={size} height={size} className={cn("shrink-0 rounded-full", className)} />;
}
