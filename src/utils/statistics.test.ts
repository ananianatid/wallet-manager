import {
  categoryChanges,
  compareTotals,
  getPeriodBounds,
  getWeekBounds,
  dailySeries,
  monthlySavingsBreakdown,
  parseWeekStartDay,
  savingsByRule,
  totals,
} from "./statistics";
import type { SavingsRule, Transaction } from "../types";

function transaction(
  id: number,
  type: Transaction["type"],
  amount: number,
  transactionDate: number,
  categoryId: number | null = null,
  categoryName: string | null = null,
): Transaction {
  return {
    id,
    type,
    amount,
    categoryId,
    categoryName,
    categoryIcon: null,
    accountId: 1,
    accountName: "Compte",
    destinationAccountId: null,
    destinationAccountName: null,
    fee: null,
    note: null,
    transactionDate,
    createdAt: 0,
  };
}

const JUNE = new Date(2026, 5, 1).getTime();
const JULY = new Date(2026, 6, 1).getTime();
const AUGUST = new Date(2026, 7, 1).getTime();
const SEPTEMBER = new Date(2026, 8, 1).getTime();

function rule(overrides: Partial<SavingsRule>): SavingsRule {
  return {
    id: 1,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    percent: 10,
    subtractFromAvailable: false,
    createdAt: 0,
    startDate: null,
    ...overrides,
  };
}

describe("savingsByRule", () => {
  it("cumule les revenus depuis la date de départ de la règle", () => {
    const income = [
      transaction(1, "income", 100_000, JULY),
      transaction(2, "income", 50_000, AUGUST),
      transaction(3, "income", 30_000, JUNE),
    ];
    const result = savingsByRule(
      income,
      [rule({ id: 1, percent: 10, startDate: JULY })],
      AUGUST,
    );
    expect(result).toEqual([
      { rule: expect.objectContaining({ id: 1 }), amount: 15_000 },
    ]);
  });

  it("ignore les revenus antérieurs à la date de départ", () => {
    const income = [
      transaction(1, "income", 100_000, JUNE),
      transaction(2, "income", 50_000, JULY),
    ];
    const result = savingsByRule(
      income,
      [rule({ id: 1, percent: 10, startDate: JULY })],
      AUGUST,
    );
    expect(result[0].amount).toBe(5_000);
  });

  it("utilise le début de période pour une règle sans date de départ", () => {
    const income = [
      transaction(1, "income", 100_000, JULY),
      transaction(2, "income", 50_000, AUGUST),
    ];
    const result = savingsByRule(
      income,
      [rule({ id: 1, percent: 10, startDate: null })],
      AUGUST,
    );
    expect(result[0].amount).toBe(5_000);
  });

  it("cumule tout l'historique quand la période commence à zéro", () => {
    const income = [
      transaction(1, "income", 100_000, JULY),
      transaction(2, "income", 50_000, AUGUST),
      transaction(3, "income", 30_000, JUNE),
    ];
    const result = savingsByRule(
      income,
      [rule({ id: 1, percent: 10, startDate: null })],
      0,
    );
    expect(result[0].amount).toBe(18_000);
  });

  it("combine une règle globale et une règle par catégorie", () => {
    const income = [
      transaction(1, "income", 100_000, AUGUST, 10, "Salaire"),
      transaction(2, "income", 20_000, AUGUST, 11, "Virement reçu"),
      transaction(3, "expense", 9_000, AUGUST),
    ];
    const result = savingsByRule(
      income,
      [
        rule({ id: 1, categoryId: null, percent: 10 }),
        rule({ id: 2, categoryId: 10, percent: 20 }),
      ],
      AUGUST,
    );
    expect(result.find((c) => c.rule.id === 1)!.amount).toBe(2_000);
    expect(result.find((c) => c.rule.id === 2)!.amount).toBe(20_000);
  });

  it("plafonne à la fin de la période fournie", () => {
    const income = [
      transaction(1, "income", 100_000, JULY),
      transaction(2, "income", 50_000, SEPTEMBER),
    ];
    const result = savingsByRule(
      income.slice(0, 1),
      [rule({ id: 1, percent: 10, startDate: JULY })],
      AUGUST,
    );
    expect(result[0].amount).toBe(10_000);
  });

  it("ne compte que les revenus", () => {
    const rows = [
      transaction(1, "income", 100_000, AUGUST),
      transaction(2, "expense", 50_000, AUGUST),
      transaction(3, "transfer", 30_000, AUGUST),
    ];
    const result = savingsByRule(rows, [rule({ id: 1, percent: 10 })], AUGUST);
    expect(result[0].amount).toBe(10_000);
  });

  it("arrondit le montant de chaque contribution", () => {
    const income = [transaction(1, "income", 25_555, AUGUST)];
    const result = savingsByRule(income, [rule({ id: 1, percent: 10 })], AUGUST);
    expect(result[0].amount).toBe(2_556);
  });

  it("sépare les règles informatives des règles retirées du disponible", () => {
    const result = monthlySavingsBreakdown(
      [
        transaction(1, "income", 100_000, AUGUST),
        transaction(2, "income", 50_000, AUGUST, 10, "Salaire"),
      ],
      [
        rule({ id: 1, categoryId: null, percent: 10, subtractFromAvailable: true }),
        rule({ id: 2, categoryId: 10, percent: 20, subtractFromAvailable: false }),
      ],
      [{ year: 2026, month: 7 }],
    );

    expect(result[0]).toMatchObject({ total: 20_000, subtractableTotal: 10_000 });
  });
});

describe("totals", () => {
  it("calcule revenus, dépenses, frais et net", () => {
    const rows = [
      transaction(1, "income", 100_000, AUGUST),
      transaction(2, "expense", 40_000, AUGUST),
      { ...transaction(3, "transfer", 60_000, AUGUST), fee: 1_500 },
    ];
    expect(totals(rows)).toEqual({
      income: 100_000,
      expense: 40_000,
      fees: 1_500,
      net: 58_500,
    });
  });
});

describe("comparaisons", () => {
  it("compare les totaux et conserve un pourcentage nul comme indéterminé", () => {
    expect(
      compareTotals(
        { income: 120_000, expense: 30_000, fees: 2_000, net: 88_000 },
        { income: 100_000, expense: 40_000, fees: 0, net: 60_000 },
      ),
    ).toEqual({
      income: { current: 120_000, previous: 100_000, delta: 20_000, percent: 20 },
      expense: { current: 30_000, previous: 40_000, delta: -10_000, percent: -25 },
      fees: { current: 2_000, previous: 0, delta: 2_000, percent: null },
      net: {
        current: 88_000,
        previous: 60_000,
        delta: 28_000,
        percent: expect.closeTo(46.666, 2),
      },
    });
  });

  it("fusionne les catégories nouvelles, supprimées et conservées", () => {
    const changes = categoryChanges(
      [
        transaction(1, "expense", 60_000, AUGUST, 1, "Logement"),
        transaction(2, "expense", 15_000, AUGUST, 2, "Transport"),
      ],
      [
        transaction(3, "expense", 40_000, JULY, 1, "Logement"),
        transaction(4, "expense", 25_000, JULY, 3, "Alimentation"),
      ],
      "expense",
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryName: "Logement", delta: 20_000, percent: 50 }),
        expect.objectContaining({ categoryName: "Transport", delta: 15_000, percent: null }),
        expect.objectContaining({ categoryName: "Alimentation", delta: -25_000, percent: -100 }),
      ]),
    );
  });
});

describe("getPeriodBounds", () => {
  it("sélectionne le mois choisi", () => {
    expect(getPeriodBounds("month", { year: 2026, month: 5 })).toEqual({
      startMs: JUNE,
      endMs: JULY,
    });
  });

  it("sélectionne les trois mois du trimestre choisi", () => {
    expect(getPeriodBounds("quarter", { year: 2026, month: 5 })).toEqual({
      startMs: new Date(2026, 3, 1).getTime(),
      endMs: JULY,
    });
  });

  it("sélectionne toute l’année choisie", () => {
    expect(getPeriodBounds("year", { year: 2026, month: 5 })).toEqual({
      startMs: new Date(2026, 0, 1).getTime(),
      endMs: new Date(2027, 0, 1).getTime(),
    });
  });

  it("retourne une période ouverte pour Tout", () => {
    expect(getPeriodBounds("all", { year: 2026, month: 5 })).toEqual({
      startMs: null,
      endMs: null,
    });
  });
});

describe("getWeekBounds", () => {
  it("commence le lundi par défaut", () => {
    expect(getWeekBounds(new Date(2026, 5, 3).getTime(), 1)).toEqual({
      startMs: new Date(2026, 5, 1).getTime(),
      endMs: new Date(2026, 5, 8).getTime(),
    });
  });

  it("respecte un dimanche comme premier jour choisi", () => {
    expect(getWeekBounds(new Date(2026, 5, 3).getTime(), 0)).toEqual({
      startMs: new Date(2026, 4, 31).getTime(),
      endMs: new Date(2026, 5, 7).getTime(),
    });
  });
});

describe("parseWeekStartDay", () => {
  it("utilise lundi comme valeur par défaut", () => {
    expect(parseWeekStartDay(null)).toBe(1);
    expect(parseWeekStartDay("9")).toBe(1);
  });
});

describe("dailySeries", () => {
  it("crée un point pour chaque jour de la période", () => {
    const result = dailySeries(
      [
        transaction(1, "income", 100_000, new Date(2026, 5, 1, 10).getTime()),
        transaction(2, "expense", 25_000, new Date(2026, 5, 3, 12).getTime()),
      ],
      new Date(2026, 5, 1).getTime(),
      new Date(2026, 5, 4).getTime(),
    );

    expect(result).toHaveLength(3);
    expect(result.map((point) => point.day)).toEqual([1, 2, 3]);
    expect(result[0].income).toBe(100_000);
    expect(result[1].net).toBe(0);
    expect(result[2].expense).toBe(25_000);
  });
});
