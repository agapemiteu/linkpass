import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "@/lib/db";
import { balances } from "@/lib/finance/ledger";
import { mockClient } from "@/lib/bank/mock-client";
import { BankError, type BankClient } from "@/lib/bank/types";
import { createPurchase, decide, executeTransfer, fundAllowance, getPurchase, refresh, requestApproval, finalize } from "@/lib/purchases";

const SRC = "0123456789";
const parent = { id: "guardian_001", familyId: "family_001" };
let db: Database.Database;

beforeEach(async () => {
  db = openDb(":memory:");
  await mockClient.adminReset();
  await fundAllowance(db, mockClient, "child_001", "guardian_001", 5_000_000, SRC);
});

describe("trusted allowance", () => {
  it("pays an eligible purchase and books it", async () => {
    const p = createPurchase(db, "child_001", "off_sneaker", {});
    expect(p.decision).toBe("AUTO_APPROVED");
    const r = await executeTransfer(db, mockClient, p.id, parent, SRC);
    expect(r.status).toBe("PAID");
    expect(balances(db, "child_001")).toMatchObject({ availableKobo: 3_500_000, reservedKobo: 0, spentKobo: 1_500_000 });
  });

  it("refuses to execute twice", async () => {
    const p = createPurchase(db, "child_001", "off_sneaker", {});
    await executeTransfer(db, mockClient, p.id, parent, SRC);
    await expect(executeTransfer(db, mockClient, p.id, parent, SRC)).rejects.toThrow(/already/);
  });

  it("refuses to execute a purchase that needs a parent", async () => {
    const p = createPurchase(db, "child_001", "off_hightop", {});
    expect(p.decision).toBe("NEEDS_PARENT_APPROVAL");
    await expect(executeTransfer(db, mockClient, p.id, parent, SRC)).rejects.toThrow(/isn't authorized/);
  });

  it("blocks the impersonator", () => {
    expect(createPurchase(db, "child_001", "off_fake", {}).decision).toBe("BLOCKED");
  });

  it("two concurrent purchases cannot overspend", async () => {
    db.prepare("UPDATE policies SET daily_limit_kobo = 100000000").run();
    // 50,000 allowance: three 15,000 purchases fit, the fourth must not.
    const ids = [1, 2, 3, 4].map(() => createPurchase(db, "child_001", "off_sneaker", {}).id);
    const results = await Promise.all(ids.map((id) => executeTransfer(db, mockClient, id, parent, SRC)));
    expect(results.filter((r) => r.status === "PAID")).toHaveLength(3);
    expect(results.filter((r) => r.status === "NEEDS_PARENT_APPROVAL")).toHaveLength(1);
    expect(balances(db, "child_001").availableKobo).toBe(500_000);
  });

  it("keeps funds reserved on timeout and settles on requery without resending", async () => {
    const p = createPurchase(db, "child_001", "off_sneaker", {});
    const r = await executeTransfer(db, mockClient, p.id, parent, SRC, "timeout");
    expect(r.status).toBe("PAYMENT_PENDING");
    expect(balances(db, "child_001").reservedKobo).toBe(1_500_000);
    let sends = 0;
    const counting: BankClient = { ...mockClient, intraTransfer: async (...a) => { sends++; return mockClient.intraTransfer(...a); } };
    await refresh(db, counting, p.id);
    expect(sends).toBe(0);
    finalize(db, p.id, "successful");
    expect(getPurchase(db, p.id)!.status).toBe("PAID");
  });

  it("releases funds on a definite failure", async () => {
    const p = createPurchase(db, "child_001", "off_sneaker", {});
    const failing: BankClient = { ...mockClient, intraTransfer: async () => { throw new BankError("INSUFFICIENT_FUNDS", "no", 402); } };
    expect((await executeTransfer(db, failing, p.id, parent, SRC)).status).toBe("FAILED");
    expect(balances(db, "child_001").availableKobo).toBe(5_000_000);
  });

  it("restores the allowance only once on reversal", async () => {
    const p = createPurchase(db, "child_001", "off_sneaker", {});
    await executeTransfer(db, mockClient, p.id, parent, SRC);
    finalize(db, p.id, "reversed");
    finalize(db, p.id, "reversed");
    expect(balances(db, "child_001")).toMatchObject({ availableKobo: 5_000_000, spentKobo: 0 });
  });

  it("blocks payment if the bank resolves a different account holder", async () => {
    const p = createPurchase(db, "child_001", "off_sneaker", {});
    const swapped: BankClient = { ...mockClient, intraNameEnquiry: async (n) => ({ nameEnquiryRef: "x", accountName: "SOMEONE ELSE", accountNumber: n }) };
    expect((await executeTransfer(db, swapped, p.id, parent, SRC)).status).toBe("FAILED");
  });

  it("refuses an allowance the bank account can't back", async () => {
    await expect(fundAllowance(db, mockClient, "child_001", "guardian_001", 50_000_000, SRC).then(() =>
      fundAllowance(db, mockClient, "child_001", "guardian_001", 50_000_000, SRC),
    ).then(() => fundAllowance(db, mockClient, "child_001", "guardian_001", 50_000_000, SRC))).rejects.toThrow(/back/);
  });
});

describe("parent approval", () => {
  it("allowance exception pays only the exact approved purchase", async () => {
    const p = createPurchase(db, "child_001", "off_hightop", {});
    requestApproval(db, p.id, "child_001");
    decide(db, p.id, parent, "APPROVE", "ALLOWANCE");
    expect((await executeTransfer(db, mockClient, p.id, parent, SRC)).status).toBe("PAID");
    const other = createPurchase(db, "child_001", "off_hightop", {});
    await expect(executeTransfer(db, mockClient, other.id, parent, SRC)).rejects.toThrow();
  });

  it("another family can't approve", () => {
    const p = createPurchase(db, "child_001", "off_hightop", {});
    requestApproval(db, p.id, "child_001");
    expect(() => decide(db, p.id, { id: "x", familyId: "family_999" }, "APPROVE")).toThrow(/not found/);
  });

  it("an approval can't be given twice", () => {
    const p = createPurchase(db, "child_001", "off_hightop", {});
    requestApproval(db, p.id, "child_001");
    decide(db, p.id, parent, "DECLINE");
    expect(() => decide(db, p.id, parent, "APPROVE")).toThrow(/no longer/);
  });
});
