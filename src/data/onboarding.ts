import { createAccount, updateAccountForOnboarding } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { listCategories } from "@/db/categories";
import { createTransaction } from "@/db/transactions";
import { getSetting, setSetting } from "@/db/settings";
import type { TransactionType } from "@/types";

export async function loadOnboardingState() {
  const db = await getDatabase();
  const [started, draftName, draftCurrency, draftStep, storedId] = await Promise.all([
    getSetting(db, "onboarding_started"),
    getSetting(db, "onboarding_account_name"),
    getSetting(db, "onboarding_currency"),
    getSetting(db, "onboarding_step"),
    getSetting(db, "onboarding_account_id"),
  ]);
  const accountId = Number(storedId);
  const account = Number.isInteger(accountId) && accountId > 0
    ? await db.getFirstAsync<{ id: number; name: string; currencyCode: string }>(
        "SELECT id, name, currency_code AS currencyCode FROM accounts WHERE id = ? AND deleted_at IS NULL",
        accountId,
      )
    : null;
  return { started, draftName, draftCurrency, draftStep, account };
}

export function loadOnboardingCategories() {
  return getDatabase().then(listCategories);
}

export async function saveOnboardingAccount(input: { accountId: number | null; name: string; currencyCode: string }) {
  const db = await getDatabase();
  await setSetting(db, "onboarding_started", "1");
  await setSetting(db, "onboarding_account_name", input.name.trim());
  await setSetting(db, "onboarding_currency", input.currencyCode);
  await setSetting(db, "onboarding_step", "2");
  if (input.accountId != null) {
    await updateAccountForOnboarding(db, input.accountId, {
      name: input.name,
      currencyCode: input.currencyCode,
    });
  }
}

export async function finishOnboarding(input: {
  accountId: number | null;
  accountName: string;
  currencyCode: string;
  withTransaction: boolean;
  transactionType: Exclude<TransactionType, "transfer">;
  amount: number | null;
  categoryId: number | null;
}) {
  const db = await getDatabase();
  let accountId = input.accountId;
  await db.withTransactionAsync(async () => {
    if (accountId == null) {
      accountId = await createAccount(db, { name: input.accountName, groupId: null, currencyCode: input.currencyCode });
    }
    if (input.withTransaction && accountId != null && input.amount != null && input.categoryId != null) {
      await createTransaction(db, {
        type: input.transactionType,
        amount: input.amount,
        categoryId: input.categoryId,
        accountId,
        destinationAccountId: null,
        fee: null,
        note: null,
        transactionDate: Date.now(),
      });
    }
    await setSetting(db, "base_currency", input.currencyCode);
    await setSetting(db, "onboarding_completed", "1");
  });
  return { accountId, cloudWelcomeSeen: await getSetting(db, "cloud_welcome_seen") === "1" };
}

export function setOnboardingStep(step: 1 | 2): Promise<void> {
  return getDatabase().then((db) => setSetting(db, "onboarding_step", String(step)));
}
