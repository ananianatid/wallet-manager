import { formatAmount } from "@/currency/currencies";

const ENTITY_LABELS: Record<string, string> = {
  categories: "Catégorie",
  account_groups: "Groupe de comptes",
  accounts: "Compte",
  transactions: "Transaction",
  transaction_splits: "Ventilation",
  people: "Personne",
  reimbursements: "Remboursement",
  reimbursement_settlements: "Règlement",
  tags: "Tag",
  transaction_tags: "Tag de transaction",
  transaction_attachments: "Pièce jointe",
  budget_plans: "Budget",
  budget_periods: "Période budgétaire",
  recurring_transactions: "Récurrence",
  recurring_occurrences: "Échéance",
  savings_rules: "Règle d’épargne",
  goals: "Objectif",
  goal_reservations: "Réservation",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  type: "Type",
  amount: "Montant",
  fee: "Frais",
  transaction_date: "Date",
  created_at: "Créé le",
  note: "Note",
  merchant: "Marchand",
  is_seed: "Système",
  icon: "Icône",
  color: "Couleur",
  target_amount: "Cible",
  current_amount: "Actuel",
  archived: "Archivé",
  hidden: "Masqué",
  include_in_available: "Dans disponible",
};

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatFieldValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (key === "type") {
    if (value === "income") return "Revenu";
    if (value === "expense") return "Dépense";
    if (value === "transfer") return "Transfert";
    return String(value);
  }
  if (key === "amount" || key === "fee" || key === "target_amount" || key === "current_amount") {
    const n = Number(value);
    if (Number.isFinite(n)) return formatAmount(n, "XOF");
    return String(value);
  }
  if (key === "transaction_date" || key === "created_at" || key.endsWith("_at") || key.endsWith("_date")) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 1000000000) {
      try {
        return new Date(n).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      } catch {
        return String(value);
      }
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString("fr-FR");
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 120);
  return String(value);
}

export function humanEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function formatConflictPayload(payload: unknown): { label: string; value: string }[] {
  if (!payload || typeof payload !== "object") return [{ label: "Données", value: String(payload) }];
  const obj = payload as Record<string, unknown>;
  // CloudPayload shape: { fields, refs }
  const fields = (obj.fields ?? obj) as Record<string, unknown>;
  const refs = (obj.refs ?? null) as Record<string, unknown> | null;

  const rows: { label: string; value: string }[] = [];
  if (fields && typeof fields === "object") {
    for (const [k, v] of Object.entries(fields)) {
      if (k === "sync_id" || k === "sync_version" || k === "id") continue;
      const label = FIELD_LABELS[k] ?? k.replace(/_/g, " ");
      rows.push({ label, value: formatFieldValue(k, v) });
      if (rows.length >= 8) break;
    }
  }
  if (refs && typeof refs === "object") {
    for (const [k, v] of Object.entries(refs)) {
      if (v == null) continue;
      rows.push({ label: FIELD_LABELS[k] ?? k.replace(/_/g, " "), value: typeof v === "string" ? shortId(v) : String(v) });
      if (rows.length >= 10) break;
    }
  }
  if (rows.length === 0) {
    // Fallback raw
    try {
      const raw = JSON.stringify(payload);
      rows.push({ label: "Données", value: raw.slice(0, 220) });
    } catch {
      rows.push({ label: "Données", value: String(payload) });
    }
  }
  return rows;
}
