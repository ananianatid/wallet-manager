import type { SQLiteDatabase } from "expo-sqlite";
import { createTestDb } from "@/test-utils/in-memory-db";
import {
  applyCsvImport,
  inferCsvMapping,
  parseCsvText,
  previewCsvImport,
} from "./csv-import";

async function setupDb(): Promise<SQLiteDatabase> {
  const db = await createTestDb();
  const category = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE type = 'account' ORDER BY id LIMIT 1",
  );
  await db.runAsync(
    `INSERT INTO accounts (id, name, category_id, currency_code, created_at)
     VALUES (1, 'Compte courant', ?, 'XOF', 1),
            (2, 'Espèces', ?, 'XOF', 1)`,
    category!.id,
    category!.id,
  );
  return db;
}

describe("import CSV universel", () => {
  it("parse les guillemets, séparateurs locaux, dates françaises et montants signés", () => {
    const document = parseCsvText(
      'Date;Montant;Marchand;Note\n31/01/2026;-1 200;"Marché; central";"Achat, semaine"',
    );
    expect(document.separator).toBe(";");
    expect(document.rows[0]).toEqual({
      Date: "31/01/2026",
      Montant: "-1 200",
      Marchand: "Marché; central",
      Note: "Achat, semaine",
    });
  });

  it("prévisualise les inconnues et désélectionne les doublons probables", async () => {
    const db = await setupDb();
    const text = [
      "Date,Montant,Marchand,Catégorie,Tags",
      "2026-01-31,-1200,Marché central,Nourriture,courses|Maison",
      "2026-02-01,5000,Client inconnu,Categorie absente,vente",
    ].join("\n");
    const mapping = inferCsvMapping(["Date", "Montant", "Marchand", "Catégorie", "Tags"]);
    const first = await previewCsvImport(db, text, {
      accountId: 1,
      currencyCode: "XOF",
      mapping,
    });
    expect(first[0]).toMatchObject({ selected: true, parsed: { type: "expense", amount: 1200 } });
    expect(first[1].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unknown_category", severity: "warning" })]),
    );
    const report = await applyCsvImport(db, first, {
      accountId: 1,
      currencyCode: "XOF",
      mapping,
      sourceName: "janvier.csv",
    });
    expect(report).toMatchObject({ inserted: 2, invalidRows: 0 });

    const second = await previewCsvImport(db, text, {
      accountId: 1,
      currencyCode: "XOF",
      mapping,
    });
    expect(second[0]).toMatchObject({ probableDuplicate: true, selected: false });
    expect(second[1]).toMatchObject({ probableDuplicate: true, selected: false });
  });

  it("n'écrit jamais les lignes invalides", async () => {
    const db = await setupDb();
    const text = "Date,Montant\n2026-01-31,abc\nnot-a-date,100";
    const mapping = inferCsvMapping(["Date", "Montant"]);
    const preview = await previewCsvImport(db, text, {
      accountId: 1,
      currencyCode: "XOF",
      mapping,
    });
    expect(preview.every((row) => !row.selected)).toBe(true);
    const report = await applyCsvImport(db, preview, {
      accountId: 1,
      currencyCode: "XOF",
      mapping,
    });
    expect(report.inserted).toBe(0);
    expect(await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))
      .toMatchObject({ count: 0 });
  });
});
