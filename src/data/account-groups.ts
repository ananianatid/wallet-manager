import {
  assignAccountGroup,
  createAccountGroup,
  listAccountGroups,
  listDeletedAccountGroups,
  renameAccountGroup,
  reorderAccountGroups,
  restoreAccountGroup,
  softDeleteAccountGroup,
} from "@/db/account-groups";
import { listAccounts, listDeletedAccounts, restoreAccount } from "@/db/accounts";
import { getDatabase } from "@/db/database";

export async function loadAccountGroupsManagement() {
  const db = await getDatabase();
  const [groups, deletedGroups, accounts] = await Promise.all([
    listAccountGroups(db),
    listDeletedAccountGroups(db),
    listAccounts(db),
  ]);
  return { groups, deletedGroups, accounts };
}
export async function createLocalAccountGroup(name: string) { await createAccountGroup(await getDatabase(), name); }
export async function renameLocalAccountGroup(id: number, name: string) { await renameAccountGroup(await getDatabase(), id, name); }
export async function deleteLocalAccountGroup(id: number) { await softDeleteAccountGroup(await getDatabase(), id); }
export async function reorderLocalAccountGroups(ids: number[]) { await reorderAccountGroups(await getDatabase(), ids); }
export async function restoreLocalAccountGroup(id: number) { await restoreAccountGroup(await getDatabase(), id); }
export async function assignLocalAccountGroup(accountId: number, groupId: number | null) { await assignAccountGroup(await getDatabase(), accountId, groupId); }

export async function loadAccountsManagement() {
  const db = await getDatabase();
  const [groups, accounts, deletedAccounts] = await Promise.all([
    listAccountGroups(db), listAccounts(db), listDeletedAccounts(db),
  ]);
  return { groups, accounts, deletedAccounts };
}
export async function restoreLocalAccount(id: number) { await restoreAccount(await getDatabase(), id); }
