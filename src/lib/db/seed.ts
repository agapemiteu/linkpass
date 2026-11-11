import type { Db } from "./index";

// Synthetic demo data. Settlement accounts come from the Forge sandbox fixtures (API spec v2, "Merchants").
// The sandbox maps mer_206 to account 0123456790, held by "Babatunde Olumide Adeyemi". The fixture does
// not establish that the holder and the store are the same entity, so we store the bank-resolved holder name.
export async function seed(db: Db) {
  const ts = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString();

  const user = "INSERT INTO users VALUES (?,?,?,?,?)";
  await db.run(user, "guardian_001", "Adaeze", "GUARDIAN", "family_001", ts);
  await db.run(user, "child_001", "Mira", "CHILD", "family_001", ts);

  const merchant = "INSERT INTO merchants VALUES (?,?,?,?,?,?,?,?,?,1,?)";
  await db.run(merchant, "mer_206", "Ọ̀ṣun Threads", "Ọ̀ṣun Threads", "mer_206", "fashion", "000014", "0123456790", "BABATUNDE OLUMIDE ADEYEMI", "VERIFIED", ts);
  await db.run(merchant, "mer_204", "Mama Nkechi Provisions", "Mama Nkechi Provisions Ltd", "mer_204", "groceries", "000014", "0123456793", "MAMA NKECHI PROVISIONS LTD", "VERIFIED", ts);
  // Test-only impersonator: copies the store's look, pays to an unrelated personal account.
  await db.run(merchant, "unv_001", "Osun Threadz", "Unknown", null, "fashion", "000013", "0123987001", "CHUKWUEMEKA IFEANYI NWOSU", "UNVERIFIED", null);

  const profile = "INSERT INTO merchant_social_profiles VALUES (?,?,?,?,?)";
  await db.run(profile, "msp_1", "mer_206", "instagram", "osunthreads", 1);
  await db.run(profile, "msp_2", "mer_204", "instagram", "mamankechiprovisions", 1);
  await db.run(profile, "msp_3", "unv_001", "instagram", "osun.threadz", 0);

  const offer = "INSERT INTO offers VALUES (?,?,?,?,?,?,?,?,?)";
  const img = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;
  await db.run(offer, "off_sneaker", "mer_206", "Canvas low-top sneakers", "Tan canvas, white rubber sole. Sizes 37–44.",
    "footwear", img("photo-1549298916-b41d501d3772"), 1_500_000, "CONFIRMED", "https://www.instagram.com/osunthreads/p/canvas-sneakers");
  await db.run(offer, "off_hightop", "mer_206", "Red leather sneakers", "Leather upper, cushioned sole. Sizes 37–44.",
    "footwear", img("photo-1542291026-7eec264c27ff"), 3_500_000, "CONFIRMED", "https://www.instagram.com/osunthreads/p/leather-hightops");
  await db.run(offer, "off_tee", "mer_206", "Adire print tee", "Hand-dyed cotton, relaxed fit.",
    "clothing", img("photo-1521572163474-6864f9cf17ab"), 600_000, "CONFIRMED", "https://www.instagram.com/osunthreads/p/adire-tee");
  await db.run(offer, "off_snacks", "mer_204", "Weekend snack box", "Chin chin, plantain chips, juice.",
    "groceries", img("photo-1599490659213-e2b9527bd087"), 500_000, "CONFIRMED", "https://www.instagram.com/mamankechiprovisions/p/snack-box");
  await db.run(offer, "off_fake", "unv_001", "Canvas low-top sneakers", "Same photos as the original store.",
    "footwear", img("photo-1549298916-b41d501d3772"), 1_200_000, "CONFIRMED", "https://www.instagram.com/osun.threadz/p/canvas-sneakers");

  await db.run("INSERT INTO policies VALUES (?,?,?,?,?,?,?,?,?,?)", "pol_001", "family_001", "child_001", 1, "ACTIVE", 2_000_000, 4_000_000, in30, "guardian_001", ts);
  await db.run("INSERT INTO policy_merchants VALUES (?,?,?)", "pol_001", "mer_206", "000014:0123456790");
  await db.run("INSERT INTO policy_categories VALUES (?,?)", "pol_001", "clothing");
  await db.run("INSERT INTO policy_categories VALUES (?,?)", "pol_001", "footwear");
}
