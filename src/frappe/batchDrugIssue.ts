import { frappeCreateAndSubmit, todayISO } from "@/src/services/api";

import { getDocument } from "./generic";

export type BatchDrugRow = {
  itemCode: string;
  qty: number;             // batch total quantity
  uom?: string;
  sourceWarehouse: string;
  withdrawalDays?: number;
};

export type BatchDrugIssueInput = {
  /** Drug rows with batch-total quantities. May be empty if the user only entered an activity cost. */
  drugRows: BatchDrugRow[];
  /** Batch-total vet fee. If > 0 and Vet Expense accounts are configured, posts one JE. */
  activityCost?: number;
  /** Server-assigned Animal Event names that this batch covers. May be empty when replaying offline. */
  eventNames: string[];
  /** Client-generated id grouping events + this batch issue. Lands in remarks for forensic linking. */
  batchId: string;
  /** Human-readable batch label, e.g. "Vaccination · 50 animals · 2026-05-29". */
  remarks: string;
  /** Frappe Company for the Stock Entry and JE. */
  company: string;
};

export type BatchDrugIssueResult = {
  stockEntry: { name: string } | null;
  journalEntry: { name: string } | null;
};

/**
 * Submits at most one Material Issue Stock Entry (when drugRows is non-empty)
 * and at most one Vet Expense Journal Entry (when activityCost > 0 AND the
 * Vet Expense accounts are configured in Livestock Settings).
 *
 * Failure semantics: if the Stock Entry submit fails, the error propagates
 * and the JE is not attempted. If the Stock Entry succeeds but the JE fails,
 * the function still resolves — the result reports the Stock Entry name and
 * a null journalEntry, plus a console warning. Callers decide how to surface
 * a partial state.
 */
export async function submitBatchDrugIssue(
  input: BatchDrugIssueInput,
): Promise<BatchDrugIssueResult> {
  const result: BatchDrugIssueResult = { stockEntry: null, journalEntry: null };

  const baseRemarks = buildRemarks(input);

  if (input.drugRows.length > 0) {
    const se = await frappeCreateAndSubmit<{ name: string }>("Stock Entry", {
      stock_entry_type: "Material Issue",
      company: input.company,
      posting_date: todayISO(),
      remarks: baseRemarks,
      items: input.drugRows.map((d) => ({
        item_code: d.itemCode,
        qty: d.qty,
        uom: d.uom,
        s_warehouse: d.sourceWarehouse,
      })),
    });
    result.stockEntry = { name: se.name };
  }

  if (input.activityCost && input.activityCost > 0) {
    try {
      const accounts = await readVetExpenseAccounts();
      if (accounts) {
        const je = await frappeCreateAndSubmit<{ name: string }>("Journal Entry", {
          voucher_type: "Journal Entry",
          company: input.company,
          posting_date: todayISO(),
          user_remark: baseRemarks,
          accounts: [
            {
              account: accounts.debit,
              debit_in_account_currency: input.activityCost,
              credit_in_account_currency: 0,
            },
            {
              account: accounts.credit,
              debit_in_account_currency: 0,
              credit_in_account_currency: input.activityCost,
            },
          ],
        });
        result.journalEntry = { name: je.name };
      } else {
        console.warn(
          "[batchDrugIssue] Vet Expense accounts not configured in Livestock Settings; JE skipped.",
        );
      }
    } catch (e) {
      console.warn("[batchDrugIssue] JE submit failed; Stock Entry already posted", e);
    }
  }

  return result;
}

function buildRemarks(input: BatchDrugIssueInput): string {
  const parts = [input.remarks, `Batch ${input.batchId}`];
  if (input.eventNames.length) {
    parts.push(`Events: ${input.eventNames.slice(0, 10).join(", ")}${input.eventNames.length > 10 ? "…" : ""}`);
  }
  return parts.join(" · ");
}

type VetExpenseAccounts = { debit: string; credit: string };

async function readVetExpenseAccounts(): Promise<VetExpenseAccounts | null> {
  const settings = await getDocument<{
    custom_vet_expense_account?: string;
    custom_vet_expense_credit_account?: string;
  }>("Livestock Settings", "Livestock Settings", [
    "custom_vet_expense_account",
    "custom_vet_expense_credit_account",
  ]);
  if (!settings?.custom_vet_expense_account || !settings?.custom_vet_expense_credit_account) {
    return null;
  }
  return {
    debit: settings.custom_vet_expense_account,
    credit: settings.custom_vet_expense_credit_account,
  };
}
