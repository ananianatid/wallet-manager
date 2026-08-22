import { listAccountGroups } from "@/db/account-groups";
import { createAccount, deleteAccount, getAccount, listAccounts, planBalanceAdjustment, setAccountBalance, updateAccountDetails, updateAccountFlags } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { listTransactionsByAccount } from "@/db/transactions";
import type { Account, AccountInput } from "@/types";

export interface AccountsSnapshot {
  accounts: Account[];
  accountGroups: Awaited<ReturnType<typeof listAccountGroups>>;
}

export async function loadAccountsSnapshot(): Promise<AccountsSnapshot> {
  const db = await getDatabase();
  const [accounts, accountGroups] = await Promise.all([
    listAccounts(db),
    listAccountGroups(db),
  ]);
  return { accounts, accountGroups };
}

export async function createLocalAccount(input: AccountInput): Promise<void> {
  await createAccount(await getDatabase(), input);
}

export async function updateLocalAccountFlags(
  accountId: number,
  flags: { hidden?: boolean; excludeFromTotal?: boolean },
): Promise<void> {
  await updateAccountFlags(await getDatabase(), accountId, flags);
}

export async function deleteLocalAccount(accountId: number): Promise<void> {
  await deleteAccount(await getDatabase(), accountId);
}

export async function loadAccountDetail(accountId: number) {
  const db = await getDatabase();
  const [account, transactions] = await Promise.all([getAccount(db, accountId), listTransactionsByAccount(db, accountId)]);
  return { account, transactions };
}

export async function loadAccountEditor(accountId: number) {
  const db = await getDatabase();
  const [account, accountGroups] = await Promise.all([getAccount(db, accountId), listAccountGroups(db)]);
  return { account, accountGroups };
}

export function planLocalAccountBalanceAdjustment(balance: number, target: number) {
  return planBalanceAdjustment(balance, target);
}

export async function saveLocalAccountEdit(input: {
  id: number;
  name: string;
  groupId: number | null;
  description: string;
  hidden: boolean;
  excludeFromTotal: boolean;
  targetBalance: number | null;
}) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await updateAccountDetails(db, input.id, {
      name: input.name,
      groupId: input.groupId,
      description: input.description,
    });
    await updateAccountFlags(db, input.id, {
      hidden: input.hidden,
      excludeFromTotal: input.excludeFromTotal,
    });
    if (input.targetBalance != null) {
      await setAccountBalance(db, input.id, input.targetBalance);
    }
  });
}
