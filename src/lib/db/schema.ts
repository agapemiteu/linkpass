// All money is integer kobo. Policies are immutable once activated; edits create a new version.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('GUARDIAN','CHILD')),
  family_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  forge_merchant_id TEXT,
  category TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  resolved_account_name TEXT NOT NULL,
  identity_verification_status TEXT NOT NULL CHECK (identity_verification_status IN ('VERIFIED','UNVERIFIED')),
  active INTEGER NOT NULL DEFAULT 1,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS merchant_social_profiles (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  verified_binding INTEGER NOT NULL DEFAULT 0,
  UNIQUE (platform, handle)
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  price_kobo INTEGER NOT NULL CHECK (price_kobo > 0),
  status TEXT NOT NULL CHECK (status IN ('CONFIRMED','UNCONFIRMED')),
  demo_link TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  child_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED')),
  maximum_single_purchase_kobo INTEGER NOT NULL,
  daily_limit_kobo INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (child_id, version)
);

-- The beneficiary fingerprint is frozen at approval time; a changed account must not inherit the approval.
CREATE TABLE IF NOT EXISTS policy_merchants (
  policy_id TEXT NOT NULL REFERENCES policies(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  beneficiary_fingerprint TEXT NOT NULL,
  PRIMARY KEY (policy_id, merchant_id)
);

CREATE TABLE IF NOT EXISTS policy_categories (
  policy_id TEXT NOT NULL REFERENCES policies(id),
  category TEXT NOT NULL,
  PRIMARY KEY (policy_id, category)
);

CREATE TABLE IF NOT EXISTS funding_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES users(id),
  amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
  source_account TEXT NOT NULL,
  bank_available_kobo INTEGER NOT NULL,
  bank_request_id TEXT,
  status TEXT NOT NULL,
  verified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES users(id),
  source_url TEXT,
  extracted_product_json TEXT,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  price_kobo INTEGER NOT NULL,
  policy_version INTEGER,
  decision TEXT,
  reason_codes TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  purchase_request_id TEXT NOT NULL UNIQUE REFERENCES purchase_requests(id),
  guardian_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE','DECLINE')),
  method TEXT CHECK (method IN ('CHECKOUT','ALLOWANCE')),
  approved_amount_kobo INTEGER,
  approved_merchant_id TEXT,
  approved_offer_id TEXT,
  approved_beneficiary_fingerprint TEXT,
  policy_version INTEGER,
  expires_at TEXT,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  purchase_request_id TEXT NOT NULL UNIQUE REFERENCES purchase_requests(id),
  mode TEXT NOT NULL CHECK (mode IN ('TRANSFER','CHECKOUT')),
  bank_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  name_enquiry_ref TEXT,
  source_account TEXT,
  destination_account TEXT,
  amount_kobo INTEGER NOT NULL,
  total_debit_kobo INTEGER,
  payment_url TEXT,
  bank_status TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  finalized_at TEXT
);

-- Append-only double-entry journal. Each transaction's entries sum to zero.
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id TEXT PRIMARY KEY,
  business_reference TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  child_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL REFERENCES ledger_transactions(id),
  account TEXT NOT NULL CHECK (account IN ('FUNDING','AVAILABLE','RESERVED','SPENT')),
  child_id TEXT NOT NULL,
  amount_kobo INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT,
  purchase_request_id TEXT,
  actor TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
