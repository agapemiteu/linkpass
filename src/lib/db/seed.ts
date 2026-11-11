import type Database from "better-sqlite3";

// Synthetic demo data. Settlement accounts come from the Forge sandbox fixtures (API spec v2, "Merchants").
// The sandbox maps mer_206 to account 0123456790, held by "Babatunde Olumide Adeyemi". The fixture does
// not establish that the holder and the store are the same entity, so we store the bank-resolved holder name.
export function seed(db: Database.Database) {
  const ts = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString();

  const user = db.prepare("INSERT INTO users VALUES (?,?,?,?,?)");
  user.run("guardian_001", "Adaeze", "GUARDIAN", "family_001", ts);
  user.run("child_001", "Mira", "CHILD", "family_001", ts);

  const merchant = db.prepare(
    "INSERT INTO merchants VALUES (@id,@display_name,@legal_name,@forge_merchant_id,@category,@bank_code,@bank_account_number,@resolved_account_name,@status,1,@verified_at)",
  );
  merchant.run({
    id: "mer_206", display_name: "Ọ̀ṣun Threads", legal_name: "Ọ̀ṣun Threads", forge_merchant_id: "mer_206",
    category: "fashion", bank_code: "000014", bank_account_number: "0123456790",
    resolved_account_name: "BABATUNDE OLUMIDE ADEYEMI", status: "VERIFIED", verified_at: ts,
  });
  merchant.run({
    id: "mer_204", display_name: "Mama Nkechi Provisions", legal_name: "Mama Nkechi Provisions Ltd",
    forge_merchant_id: "mer_204", category: "groceries", bank_code: "000014", bank_account_number: "0123456793",
    resolved_account_name: "MAMA NKECHI PROVISIONS LTD", status: "VERIFIED", verified_at: ts,
  });
  // Test-only impersonator: copies the store's look, pays to an unrelated personal account.
  merchant.run({
    id: "unv_001", display_name: "Osun Threadz", legal_name: "Unknown", forge_merchant_id: null,
    category: "fashion", bank_code: "000013", bank_account_number: "0123987001",
    resolved_account_name: "CHUKWUEMEKA IFEANYI NWOSU", status: "UNVERIFIED", verified_at: null,
  });

  const profile = db.prepare("INSERT INTO merchant_social_profiles VALUES (?,?,?,?,?)");
  profile.run("msp_1", "mer_206", "instagram", "osunthreads", 1);
  profile.run("msp_2", "mer_204", "instagram", "mamankechiprovisions", 1);
  profile.run("msp_3", "unv_001", "instagram", "osun.threadz", 0);

  const offer = db.prepare("INSERT INTO offers VALUES (?,?,?,?,?,?,?,?,?)");
  const img = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;
  offer.run("off_sneaker", "mer_206", "Canvas low-top sneakers", "Tan canvas, white rubber sole. Sizes 37–44.",
    "footwear", img("photo-1549298916-b41d501d3772"), 1_500_000, "CONFIRMED",
    "https://www.instagram.com/osunthreads/p/canvas-sneakers");
  offer.run("off_hightop", "mer_206", "Red leather sneakers", "Leather upper, cushioned sole. Sizes 37–44.",
    "footwear", img("photo-1542291026-7eec264c27ff"), 3_500_000, "CONFIRMED",
    "https://www.instagram.com/osunthreads/p/leather-hightops");
  offer.run("off_tee", "mer_206", "Adire print tee", "Hand-dyed cotton, relaxed fit.",
    "clothing", img("photo-1521572163474-6864f9cf17ab"), 600_000, "CONFIRMED",
    "https://www.instagram.com/osunthreads/p/adire-tee");
  offer.run("off_snacks", "mer_204", "Weekend snack box", "Chin chin, plantain chips, juice.",
    "groceries", img("photo-1599490659213-e2b9527bd087"), 500_000, "CONFIRMED",
    "https://www.instagram.com/mamankechiprovisions/p/snack-box");
  offer.run("off_fake", "unv_001", "Canvas low-top sneakers", "Same photos as the original store.",
    "footwear", img("photo-1549298916-b41d501d3772"), 1_200_000, "CONFIRMED",
    "https://www.instagram.com/osun.threadz/p/canvas-sneakers");

  db.prepare("INSERT INTO policies VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    "pol_001", "family_001", "child_001", 1, "ACTIVE", 2_000_000, 4_000_000, in30, "guardian_001", ts,
  );
  db.prepare("INSERT INTO policy_merchants VALUES (?,?,?)").run("pol_001", "mer_206", "000014:0123456790");
  const cat = db.prepare("INSERT INTO policy_categories VALUES (?,?)");
  cat.run("pol_001", "clothing");
  cat.run("pol_001", "footwear");
}
