import "server-only";
import { forgeClient } from "./forge-client";
import { mockClient } from "./mock-client";
import type { BankClient } from "./types";

export function bank(): BankClient {
  return process.env.BANK_PROVIDER === "forge" ? forgeClient : mockClient;
}

// Team-owned sandbox account used as the controlled source for pre-funded allowances.
// This is a synthetic demo arrangement, not an Access custodial or safeguarding account.
export const CONTROLLED_SOURCE_ACCOUNT = process.env.CONTROLLED_SOURCE_ACCOUNT ?? "0123456789";
