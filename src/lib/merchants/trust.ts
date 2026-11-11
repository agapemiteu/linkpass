// Seller track record used to pick the safer option.
// DEMO: these records are simulated. In production they come from a real-time web check plus
// Access settlement history, CAC registration and review sources.
export type Trust = {
  rating: number | null;
  reviews: number;
  sales: number;
  tradingSince: string;
  cacRegistered: boolean;
  scamReports: number;
};

const RECORDS: Record<string, Trust> = {
  mer_206: { rating: 4.8, reviews: 312, sales: 1240, tradingSince: "2023", cacRegistered: true, scamReports: 0 },
  mer_204: { rating: 4.6, reviews: 540, sales: 3100, tradingSince: "2021", cacRegistered: true, scamReports: 0 },
  unv_001: { rating: null, reviews: 0, sales: 0, tradingSince: "9 days ago", cacRegistered: false, scamReports: 3 },
};

const UNKNOWN: Trust = { rating: null, reviews: 0, sales: 0, tradingSince: "unknown", cacRegistered: false, scamReports: 0 };

export const trustFor = (merchantId: string): Trust => RECORDS[merchantId] ?? UNKNOWN;

// Higher is safer. Scam reports outweigh everything else.
export function trustScore(t: Trust) {
  return (t.rating ?? 0) * 10 + Math.log10(t.sales + 1) * 10 + (t.cacRegistered ? 15 : 0) - t.scamReports * 40;
}
