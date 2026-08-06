import type { SQLiteDatabase } from "expo-sqlite";
import { createGoal, updateGoal } from "./goals";

interface Call {
  sql: string;
  params: unknown[];
}

function mockDb() {
  const calls: Call[] = [];
  let seq = 100;

  const runAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
    calls.push({ sql, params });
    return { lastInsertRowId: ++seq, changes: 1 };
  });
  const getFirstAsync = jest.fn(async () => null);
  const getAllAsync = jest.fn(async () => []);

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync,
  } as unknown as SQLiteDatabase;

  return { db, calls, runAsync };
}

describe("createGoal", () => {
  it("insère nom, montant et date cible", async () => {
    const { db, calls } = mockDb();
    await createGoal(db, {
      name: "  PS5  ",
      targetAmount: 350_000,
      targetDate: new Date(2027, 0, 1).getTime(),
    });
    expect(calls[0].sql).toContain("INSERT INTO goals");
    expect(calls[0].params).toEqual([
      "PS5",
      350_000,
      new Date(2027, 0, 1).getTime(),
      expect.any(Number),
    ]);
  });

  it("rejette un nom vide", async () => {
    const { db } = mockDb();
    await expect(
      createGoal(db, { name: "   ", targetAmount: 100, targetDate: 1 }),
    ).rejects.toThrow("ne peut pas être vide");
  });

  it("rejette un montant non entier ou négatif", async () => {
    const { db } = mockDb();
    await expect(
      createGoal(db, { name: "X", targetAmount: 12.5, targetDate: 1 }),
    ).rejects.toThrow("entier positif");
    await expect(
      createGoal(db, { name: "X", targetAmount: 0, targetDate: 1 }),
    ).rejects.toThrow("entier positif");
  });
});

describe("updateGoal", () => {
  it("met à jour nom, montant et date cible", async () => {
    const { db, calls } = mockDb();
    await updateGoal(db, 7, {
      name: "Nouveau nom",
      targetAmount: 500_000,
      targetDate: new Date(2028, 5, 15).getTime(),
    });
    expect(calls[0].sql).toContain("UPDATE goals SET name");
    expect(calls[0].params).toEqual([
      "Nouveau nom",
      500_000,
      new Date(2028, 5, 15).getTime(),
      7,
    ]);
  });

  it("valide le nom comme à la création", async () => {
    const { db, runAsync } = mockDb();
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 });
    await expect(
      updateGoal(db, 7, { name: "", targetAmount: 100, targetDate: 1 }),
    ).rejects.toThrow("ne peut pas être vide");
  });

  it("lève une erreur si l'objectif n'existe pas", async () => {
    const { db, runAsync } = mockDb();
    runAsync.mockResolvedValueOnce({ lastInsertRowId: 1, changes: 0 });
    await expect(
      updateGoal(db, 999, { name: "X", targetAmount: 100, targetDate: 1 }),
    ).rejects.toThrow("Objectif introuvable");
  });
});
